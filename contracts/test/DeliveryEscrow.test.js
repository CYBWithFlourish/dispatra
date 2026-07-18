const { expect } = require("chai");
const hre = require("hardhat");

describe("DeliveryEscrow", function () {
  let deployer, sender, recipient, rider, other;
  let contract;
  const NATIVE_MON = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    [deployer, sender, recipient, rider, other] = await hre.ethers.getSigners();
    const Contract = await hre.ethers.getContractFactory("DeliveryEscrow");
    contract = await Contract.deploy(deployer.address);
    await contract.waitForDeployment();
  });

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
    it("should create a job and deduct fee", async function () {
      const confirmationCode = "delivery123";
      const confirmationCodeHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(confirmationCode));
      const sentAmount = hre.ethers.parseEther("1.0");

      const tx = await contract.connect(sender).createJob(
        recipient.address,
        rider.address,
        confirmationCodeHash,
        60,
        NATIVE_MON,
        { value: sentAmount }
      );
      const receipt = await tx.wait();
      const jobCreatedEvent = receipt.logs.find(
        (log) => contract.interface.parseLog(log)?.name === "JobCreated"
      );
      const jobId = contract.interface.parseLog(jobCreatedEvent).args.jobId;

      const job = await contract.getJob(jobId);
      expect(job.sender).to.equal(sender.address);
      expect(job.recipient).to.equal(recipient.address);
      expect(job.rider).to.equal(rider.address);
      expect(job.token).to.equal(NATIVE_MON);
      expect(job.status).to.equal(0);

      const expectedFee = (sentAmount * 120n) / 10000n;
      const expectedAmount = sentAmount - expectedFee;
      expect(job.amount).to.equal(expectedAmount);
    });

    it("should reject zero value", async function () {
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("code"));
      await expect(
        contract.connect(sender).createJob(recipient.address, rider.address, hash, 60, NATIVE_MON, { value: 0 })
      ).to.be.revertedWith("Must send funds");
    });

    it("should reject unsupported token", async function () {
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("code"));
      await expect(
        contract.connect(sender).createJob(recipient.address, rider.address, hash, 60, "0x1234567890abcdef1234567890abcdef12345678", { value: hre.ethers.parseEther("1") })
      ).to.be.revertedWith("Unsupported token");
    });
  });

  describe("Role validation", function () {
    it("should reject same-address roles", async function () {
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("code"));

      await expect(
        contract.connect(sender).createJob(sender.address, rider.address, hash, 60, NATIVE_MON, { value: hre.ethers.parseEther("1") })
      ).to.be.revertedWith("Sender cannot be recipient");

      await expect(
        contract.connect(sender).createJob(recipient.address, sender.address, hash, 60, NATIVE_MON, { value: hre.ethers.parseEther("1") })
      ).to.be.revertedWith("Sender cannot be rider");

      await expect(
        contract.connect(sender).createJob(recipient.address, recipient.address, hash, 60, NATIVE_MON, { value: hre.ethers.parseEther("1") })
      ).to.be.revertedWith("Recipient cannot be rider");
    });
  });

  describe("acceptJob", function () {
    it("should allow rider to accept", async function () {
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("delivery123"));
      const tx = await contract.connect(sender).createJob(
        recipient.address, rider.address, hash, 60, NATIVE_MON, { value: hre.ethers.parseEther("1") }
      );
      const receipt = await tx.wait();
      const jobId = contract.interface.parseLog(receipt.logs.find((l) => contract.interface.parseLog(l)?.name === "JobCreated")).args.jobId;

      await contract.connect(rider).acceptJob(jobId);
      const job = await contract.getJob(jobId);
      expect(job.status).to.equal(1);
    });
  });

  describe("confirmDelivery", function () {
    it("should pay rider full amount on confirmation", async function () {
      const confirmationCode = "delivery123";
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(confirmationCode));
      const sentAmount = hre.ethers.parseEther("1.0");

      const tx = await contract.connect(sender).createJob(
        recipient.address, rider.address, hash, 60, NATIVE_MON, { value: sentAmount }
      );
      const receipt = await tx.wait();
      const jobId = contract.interface.parseLog(receipt.logs.find((l) => contract.interface.parseLog(l)?.name === "JobCreated")).args.jobId;

      const riderBalBefore = await hre.ethers.provider.getBalance(rider.address);
      const txAccept = await contract.connect(rider).acceptJob(jobId);
      const receiptAccept = await txAccept.wait();
      await contract.connect(recipient).confirmDelivery(jobId, confirmationCode);
      const riderBalAfter = await hre.ethers.provider.getBalance(rider.address);

      const expectedFee = (sentAmount * 120n) / 10000n;
      const expectedPayout = sentAmount - expectedFee;
      const gasCost = receiptAccept.gasUsed * receiptAccept.gasPrice;
      expect(riderBalAfter - riderBalBefore + gasCost).to.equal(expectedPayout);

      const job = await contract.getJob(jobId);
      expect(job.status).to.equal(2);
    });

    it("should reject short confirmation codes", async function () {
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("12345"));
      const tx = await contract.connect(sender).createJob(
        recipient.address, rider.address, hash, 60, NATIVE_MON, { value: hre.ethers.parseEther("1") }
      );
      const receipt = await tx.wait();
      const jobId = contract.interface.parseLog(receipt.logs.find((l) => contract.interface.parseLog(l)?.name === "JobCreated")).args.jobId;

      await contract.connect(rider).acceptJob(jobId);
      await expect(
        contract.connect(recipient).confirmDelivery(jobId, "12345")
      ).to.be.revertedWith("Code too short");
    });

    it("should reject invalid confirmation code", async function () {
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("delivery123"));
      const tx = await contract.connect(sender).createJob(
        recipient.address, rider.address, hash, 60, NATIVE_MON, { value: hre.ethers.parseEther("1") }
      );
      const receipt = await tx.wait();
      const jobId = contract.interface.parseLog(receipt.logs.find((l) => contract.interface.parseLog(l)?.name === "JobCreated")).args.jobId;

      await contract.connect(rider).acceptJob(jobId);
      await expect(
        contract.connect(recipient).confirmDelivery(jobId, "wrongcode")
      ).to.be.revertedWith("Invalid code");
    });
  });

  describe("cancelAndRefund", function () {
    it("should refund sender on cancel before acceptance", async function () {
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("delivery123"));
      const sentAmount = hre.ethers.parseEther("1.0");

      const tx = await contract.connect(sender).createJob(
        recipient.address, rider.address, hash, 60, NATIVE_MON, { value: sentAmount }
      );
      const receipt = await tx.wait();
      const jobId = contract.interface.parseLog(receipt.logs.find((l) => contract.interface.parseLog(l)?.name === "JobCreated")).args.jobId;

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
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("delivery123"));
      const tx = await contract.connect(sender).createJob(
        recipient.address, rider.address, hash, 1, NATIVE_MON, { value: hre.ethers.parseEther("1") }
      );
      const receipt = await tx.wait();
      const jobId = contract.interface.parseLog(receipt.logs.find((l) => contract.interface.parseLog(l)?.name === "JobCreated")).args.jobId;

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
});
