const { expect } = require("chai");
const hre = require("hardhat");

describe("DeliveryEscrow", function () {
  let deployer, sender, recipient, rider, other;
  let contract;
  const NATIVE_MON = "0x0000000000000000000000000000000000000000";
  const ZERO_HASH = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("pickup-loc"));
  const ZERO_HASH2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("delivery-loc"));

  beforeEach(async function () {
    [deployer, sender, recipient, rider, other] = await hre.ethers.getSigners();
    const Contract = await hre.ethers.getContractFactory("DeliveryEscrow");
    contract = await Contract.deploy(deployer.address);
    await contract.waitForDeployment();
  });

  async function createJobAndGetPin(signer, riderAddr, duration, value, pickupHash, deliveryHash) {
    const ph = pickupHash || ZERO_HASH;
    const dh = deliveryHash || ZERO_HASH2;
    const tx = await contract.connect(signer).createJob(
      recipient.address, riderAddr, duration, NATIVE_MON, 0, ph, dh, { value }
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find((l) => contract.interface.parseLog(l)?.name === "JobCreated");
    const parsed = contract.interface.parseLog(event);
    const rawPin = parsed.args.pin.toString();
    const pin = rawPin.padStart(6, '0');
    return { jobId: parsed.args.jobId, pin };
  }

  describe("Deployment", function () {
    it("should set owner and fee recipient to deployer", async function () {
      expect(await contract.owner()).to.equal(deployer.address);
      expect(await contract.feeRecipient()).to.equal(deployer.address);
    });

    it("should set default fees to 120 bps (1.2%)", async function () {
      expect(await contract.jobCreationFeeBps()).to.equal(120);
      expect(await contract.riderRegistrationFeeBps()).to.equal(120);
    });

    it("should support native MON by default", async function () {
      expect(await contract.supportedTokens(NATIVE_MON)).to.be.true;
    });
  });

  describe("createJob (native MON)", function () {
    it("should create a job with location hashes and generate random PIN", async function () {
      const sentAmount = hre.ethers.parseEther("1.0");
      const { jobId, pin } = await createJobAndGetPin(sender, rider.address, 60, sentAmount);

      const job = await contract.getJob(jobId);
      expect(job.sender).to.equal(sender.address);
      expect(job.recipient).to.equal(recipient.address);
      expect(job.rider).to.equal(rider.address);
      expect(job.token).to.equal(NATIVE_MON);
      expect(job.status).to.equal(0);

      expect(job.pickupLocationHash).to.equal(ZERO_HASH);
      expect(job.deliveryLocationHash).to.equal(ZERO_HASH2);

      const expectedFee = (sentAmount * 120n) / 10000n;
      const expectedAmount = sentAmount - expectedFee;
      expect(job.amount).to.equal(expectedAmount);

      expect(pin).to.have.length(6);
      expect(Number(pin)).to.be.gte(0);
      expect(Number(pin)).to.be.lt(1000000);
    });

    it("should store PIN retrievable via getJobPin", async function () {
      const { jobId, pin } = await createJobAndGetPin(sender, rider.address, 60, hre.ethers.parseEther("1"));
      const storedPin = await contract.getJobPin(jobId);
      expect(storedPin).to.equal(pin);
    });

    it("should create an open job with address(0) rider", async function () {
      const { jobId, pin } = await createJobAndGetPin(
        sender, hre.ethers.ZeroAddress, 60, hre.ethers.parseEther("1")
      );
      const job = await contract.getJob(jobId);
      expect(job.rider).to.equal(hre.ethers.ZeroAddress);
      expect(job.status).to.equal(0);
      expect(pin).to.have.length(6);
    });

    it("should reject zero value", async function () {
      await expect(
        contract.connect(sender).createJob(recipient.address, rider.address, 60, NATIVE_MON, 0, ZERO_HASH, ZERO_HASH2, { value: 0 })
      ).to.be.revertedWith("Must send funds");
    });

    it("should reject unsupported token", async function () {
      await expect(
        contract.connect(sender).createJob(recipient.address, rider.address, 60, "0x1234567890abcdef1234567890abcdef12345678", 0, ZERO_HASH, ZERO_HASH2, { value: hre.ethers.parseEther("1") })
      ).to.be.revertedWith("Unsupported token");
    });

    it("should reject sender as recipient", async function () {
      await expect(
        contract.connect(sender).createJob(sender.address, rider.address, 60, NATIVE_MON, 0, ZERO_HASH, ZERO_HASH2, { value: hre.ethers.parseEther("1") })
      ).to.be.revertedWith("Sender cannot be recipient");
    });

    it("should reject sender as designated rider", async function () {
      await expect(
        contract.connect(sender).createJob(recipient.address, sender.address, 60, NATIVE_MON, 0, ZERO_HASH, ZERO_HASH2, { value: hre.ethers.parseEther("1") })
      ).to.be.revertedWith("Sender cannot be rider");
    });

    it("should reject designated rider as recipient", async function () {
      await expect(
        contract.connect(sender).createJob(recipient.address, recipient.address, 60, NATIVE_MON, 0, ZERO_HASH, ZERO_HASH2, { value: hre.ethers.parseEther("1") })
      ).to.be.revertedWith("Recipient cannot be rider");
    });
  });

  describe("acceptJob", function () {
    it("should allow designated rider to accept", async function () {
      const { jobId } = await createJobAndGetPin(sender, rider.address, 60, hre.ethers.parseEther("1"));
      await contract.connect(rider).acceptJob(jobId);
      const job = await contract.getJob(jobId);
      expect(job.status).to.equal(1);
    });

    it("should reject non-designated rider from accepting designated job", async function () {
      const { jobId } = await createJobAndGetPin(sender, rider.address, 60, hre.ethers.parseEther("1"));
      await expect(contract.connect(other).acceptJob(jobId)).to.be.revertedWith("Only designated rider can accept");
    });

    it("should allow registered rider to accept open job", async function () {
      const fee = (120n * hre.ethers.parseEther("1")) / 10000n;
      await contract.connect(rider).registerRider({ value: fee });

      const { jobId } = await createJobAndGetPin(
        sender, hre.ethers.ZeroAddress, 60, hre.ethers.parseEther("1")
      );
      await contract.connect(rider).acceptJob(jobId);
      const job = await contract.getJob(jobId);
      expect(job.rider).to.equal(rider.address);
      expect(job.status).to.equal(1);
    });

    it("should reject unregistered rider from accepting open job", async function () {
      const { jobId } = await createJobAndGetPin(
        sender, hre.ethers.ZeroAddress, 60, hre.ethers.parseEther("1")
      );
      await expect(contract.connect(other).acceptJob(jobId)).to.be.revertedWith("Not a registered rider");
    });
  });

  describe("confirmDelivery", function () {
    it("should pay rider full amount on confirmation with correct PIN", async function () {
      const sentAmount = hre.ethers.parseEther("1.0");
      const { jobId, pin } = await createJobAndGetPin(sender, rider.address, 60, sentAmount);

      const riderBalBefore = await hre.ethers.provider.getBalance(rider.address);
      const txAccept = await contract.connect(rider).acceptJob(jobId);
      const receiptAccept = await txAccept.wait();
      await contract.connect(recipient).confirmDelivery(jobId, pin);
      const riderBalAfter = await hre.ethers.provider.getBalance(rider.address);

      const expectedFee = (sentAmount * 120n) / 10000n;
      const expectedPayout = sentAmount - expectedFee;
      const gasCost = receiptAccept.gasUsed * receiptAccept.gasPrice;
      expect(riderBalAfter - riderBalBefore + gasCost).to.equal(expectedPayout);

      const job = await contract.getJob(jobId);
      expect(job.status).to.equal(2);
    });

    it("should reject wrong PIN", async function () {
      const { jobId } = await createJobAndGetPin(sender, rider.address, 60, hre.ethers.parseEther("1"));
      await contract.connect(rider).acceptJob(jobId);
      await expect(
        contract.connect(recipient).confirmDelivery(jobId, "000000")
      ).to.be.revertedWith("Invalid code");
    });

    it("should reject short PIN", async function () {
      const { jobId } = await createJobAndGetPin(sender, rider.address, 60, hre.ethers.parseEther("1"));
      await contract.connect(rider).acceptJob(jobId);
      await expect(
        contract.connect(recipient).confirmDelivery(jobId, "12345")
      ).to.be.revertedWith("Code too short");
    });
  });

  describe("cancelAndRefund", function () {
    it("should refund sender on cancel before acceptance", async function () {
      const sentAmount = hre.ethers.parseEther("1.0");
      const { jobId } = await createJobAndGetPin(sender, rider.address, 60, sentAmount);

      const senderBalBefore = await hre.ethers.provider.getBalance(sender.address);
      const txRefund = await contract.connect(sender).cancelAndRefund(jobId);
      const receiptRefund = await txRefund.wait();
      const senderBalAfter = await hre.ethers.provider.getBalance(sender.address);

      const expectedFee = (sentAmount * 120n) / 10000n;
      const expectedRefund = sentAmount - expectedFee;
      const gasCost = receiptRefund.gasUsed * receiptRefund.gasPrice;
      expect(senderBalAfter - senderBalBefore + gasCost).to.equal(expectedRefund);

      const job = await contract.getJob(jobId);
      expect(job.status).to.equal(3);
    });

    it("should refund after timeout when accepted", async function () {
      const { jobId } = await createJobAndGetPin(sender, rider.address, 1, hre.ethers.parseEther("1"));

      await contract.connect(rider).acceptJob(jobId);
      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine");

      await contract.connect(sender).cancelAndRefund(jobId);
      const job = await contract.getJob(jobId);
      expect(job.status).to.equal(3);
    });
  });

  describe("Rider registration", function () {
    it("should register rider with fee", async function () {
      const fee = (120n * hre.ethers.parseEther("1")) / 10000n;
      const tx = await contract.connect(rider).registerRider({ value: fee });
      await tx.wait();
      expect(await contract.registeredRiders(rider.address)).to.be.true;
    });

    it("should reject double registration", async function () {
      const fee = (120n * hre.ethers.parseEther("1")) / 10000n;
      await contract.connect(rider).registerRider({ value: fee });
      await expect(
        contract.connect(rider).registerRider({ value: fee })
      ).to.be.revertedWith("Already registered");
    });
  });

  describe("Admin functions", function () {
    it("should allow owner to set fees", async function () {
      await contract.connect(deployer).setJobCreationFee(200);
      expect(await contract.jobCreationFeeBps()).to.equal(200);

      await contract.connect(deployer).setRiderRegistrationFee(300);
      expect(await contract.riderRegistrationFeeBps()).to.equal(300);
    });

    it("should reject non-owner fee changes", async function () {
      await expect(
        contract.connect(sender).setJobCreationFee(200)
      ).to.be.revertedWith("Only owner");
    });

    it("should allow owner to set fee recipient", async function () {
      await contract.connect(deployer).setFeeRecipient(other.address);
      expect(await contract.feeRecipient()).to.equal(other.address);
    });

    it("should allow owner to add and remove tokens", async function () {
      const tokenAddr = "0x1234567890abcdef1234567890abcdef12345678";
      await contract.connect(deployer).addToken(tokenAddr);
      expect(await contract.supportedTokens(tokenAddr)).to.be.true;

      await contract.connect(deployer).removeToken(tokenAddr);
      expect(await contract.supportedTokens(tokenAddr)).to.be.false;
    });

    it("should allow ownership transfer", async function () {
      await contract.connect(deployer).transferOwnership(other.address);
      expect(await contract.owner()).to.equal(other.address);
    });
  });

  describe("getOpenJobs", function () {
    it("should return only open job IDs", async function () {
      await contract.connect(sender).createJob(
        recipient.address, rider.address, 60, NATIVE_MON, 0, ZERO_HASH, ZERO_HASH2, { value: hre.ethers.parseEther("1") }
      );
      await contract.connect(sender).createJob(
        recipient.address, hre.ethers.ZeroAddress, 60, NATIVE_MON, 0, ZERO_HASH, ZERO_HASH2, { value: hre.ethers.parseEther("1") }
      );

      let openJobs = await contract.getOpenJobs();
      expect(openJobs.length).to.equal(2);

      await contract.connect(rider).acceptJob(0);
      openJobs = await contract.getOpenJobs();
      expect(openJobs.length).to.equal(1);
      expect(openJobs[0]).to.equal(1);
    });
  });
});
