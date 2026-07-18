// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract DeliveryEscrow {
    struct Job {
        address sender;
        address recipient;
        address rider;
        uint256 amount;
        bytes32 confirmationCodeHash;
        uint256 deadline;
        address token;
        Status status;
    }

    enum Status { Created, Accepted, Completed, Refunded, Cancelled }

    address public owner;
    address public feeRecipient;
    uint256 public jobCreationFeeBps;
    uint256 public riderRegistrationFeeBps;
    uint256 public constant MAX_BPS = 10000;
    uint256 public constant DEFAULT_FEE_BPS = 120;

    mapping(uint256 => Job) public jobs;
    uint256 public jobCounter;
    mapping(address => bool) public registeredRiders;
    mapping(address => bool) public supportedTokens;
    bool private locked;

    event JobCreated(
        uint256 indexed jobId,
        address indexed sender,
        address indexed rider,
        uint256 amount,
        uint256 deadline,
        address token
    );
    event JobAccepted(uint256 indexed jobId, address indexed rider);
    event DeliveryConfirmed(uint256 indexed jobId);
    event JobCancelled(uint256 indexed jobId, uint256 amount);
    event RiderRegistered(address indexed rider, uint256 fee);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event FeeRecipientChanged(address indexed previousRecipient, address indexed newRecipient);
    event JobCreationFeeChanged(uint256 previousFee, uint256 newFee);
    event RiderRegistrationFeeChanged(uint256 previousFee, uint256 newFee);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _feeRecipient) {
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        jobCreationFeeBps = DEFAULT_FEE_BPS;
        riderRegistrationFeeBps = DEFAULT_FEE_BPS;
        supportedTokens[address(0)] = true;
    }

    function registerRider() external payable nonReentrant {
        require(!registeredRiders[msg.sender], "Already registered");
        require(msg.sender != address(0), "Invalid sender");

        uint256 fee = (riderRegistrationFeeBps * 1e18) / MAX_BPS;
        if (fee > 0) {
            require(msg.value >= fee, "Insufficient registration fee");
            uint256 excess = msg.value - fee;
            if (excess > 0) {
                payable(msg.sender).transfer(excess);
            }
            payable(feeRecipient).transfer(fee);
        }

        registeredRiders[msg.sender] = true;
        emit RiderRegistered(msg.sender, fee);
    }

    function createJob(
        address _recipient,
        address _rider,
        bytes32 _confirmationCodeHash,
        uint256 _durationMinutes,
        address _token
    ) external payable returns (uint256) {
        require(_recipient != address(0), "Invalid recipient");
        require(msg.sender != _recipient, "Sender cannot be recipient");
        require(_durationMinutes > 0, "Invalid duration");
        require(_confirmationCodeHash != bytes32(0), "Invalid code hash");
        require(supportedTokens[_token], "Unsupported token");

        if (_rider != address(0)) {
            require(msg.sender != _rider, "Sender cannot be rider");
            require(_recipient != _rider, "Recipient cannot be rider");
        }

        uint256 jobId = jobCounter++;
        uint256 deadline = block.timestamp + (_durationMinutes * 1 minutes);

        uint256 amount;
        uint256 fee;

        if (_token == address(0)) {
            require(msg.value > 0, "Must send funds");
            fee = (msg.value * jobCreationFeeBps) / MAX_BPS;
            amount = msg.value - fee;
            if (fee > 0) {
                payable(feeRecipient).transfer(fee);
            }
        } else {
            fee = 0;
            amount = msg.value;
            require(amount > 0, "Must specify token amount");
            IERC20(_token).transferFrom(msg.sender, address(this), amount);
        }

        jobs[jobId] = Job({
            sender: msg.sender,
            recipient: _recipient,
            rider: _rider,
            amount: amount,
            confirmationCodeHash: _confirmationCodeHash,
            deadline: deadline,
            token: _token,
            status: Status.Created
        });

        emit JobCreated(jobId, msg.sender, _rider, amount, deadline, _token);
        return jobId;
    }

    function acceptJob(uint256 _jobId) external {
        Job storage job = jobs[_jobId];
        require(job.status == Status.Created, "Not in created status");
        require(block.timestamp < job.deadline, "Past deadline");

        if (job.rider == address(0)) {
            require(registeredRiders[msg.sender], "Not a registered rider");
            job.rider = msg.sender;
        } else {
            require(msg.sender == job.rider, "Only designated rider can accept");
        }

        job.status = Status.Accepted;
        emit JobAccepted(_jobId, msg.sender);
    }

    function confirmDelivery(uint256 _jobId, string calldata _confirmationCode) external nonReentrant {
        Job storage job = jobs[_jobId];
        require(job.status == Status.Accepted, "Job not accepted");
        require(block.timestamp < job.deadline, "Past deadline");
        require(bytes(_confirmationCode).length >= 6, "Code too short");

        bytes32 inputHash = keccak256(abi.encodePacked(_confirmationCode));
        require(inputHash == job.confirmationCodeHash, "Invalid code");

        job.status = Status.Completed;

        if (job.token == address(0)) {
            payable(job.rider).transfer(job.amount);
        } else {
            IERC20(job.token).transfer(job.rider, job.amount);
        }

        emit DeliveryConfirmed(_jobId);
    }

    function cancelAndRefund(uint256 _jobId) external nonReentrant {
        Job storage job = jobs[_jobId];
        require(msg.sender == job.sender, "Only sender can cancel");
        require(job.status == Status.Created || job.status == Status.Accepted, "Cannot cancel");

        if (job.status == Status.Accepted) {
            require(block.timestamp >= job.deadline, "Not expired yet");
        }

        job.status = Status.Refunded;

        if (job.token == address(0)) {
            payable(job.sender).transfer(job.amount);
        } else {
            IERC20(job.token).transfer(job.sender, job.amount);
        }

        emit JobCancelled(_jobId, job.amount);
    }

    function getJob(uint256 _jobId) external view returns (Job memory) {
        return jobs[_jobId];
    }

    function getOpenJobs() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < jobCounter; i++) {
            if (jobs[i].status == Status.Created) count++;
        }
        uint256[] memory openJobs = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < jobCounter; i++) {
            if (jobs[i].status == Status.Created) {
                openJobs[idx++] = i;
            }
        }
        return openJobs;
    }

    function setJobCreationFee(uint256 _bps) external onlyOwner {
        require(_bps <= MAX_BPS, "Fee exceeds maximum");
        emit JobCreationFeeChanged(jobCreationFeeBps, _bps);
        jobCreationFeeBps = _bps;
    }

    function setRiderRegistrationFee(uint256 _bps) external onlyOwner {
        require(_bps <= MAX_BPS, "Fee exceeds maximum");
        emit RiderRegistrationFeeChanged(riderRegistrationFeeBps, _bps);
        riderRegistrationFeeBps = _bps;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Invalid address");
        emit FeeRecipientChanged(feeRecipient, _recipient);
        feeRecipient = _recipient;
    }

    function addToken(address _token) external onlyOwner {
        require(_token != address(0), "Use native MON");
        require(!supportedTokens[_token], "Already supported");
        supportedTokens[_token] = true;
        emit TokenAdded(_token);
    }

    function removeToken(address _token) external onlyOwner {
        require(supportedTokens[_token], "Not supported");
        supportedTokens[_token] = false;
        emit TokenRemoved(_token);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        emit OwnerChanged(owner, _newOwner);
        owner = _newOwner;
    }
}
