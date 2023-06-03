// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract StakingContractUpgrade is Initializable,ReentrancyGuardUpgradeable,OwnableUpgradeable,PausableUpgradeable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /// @notice Info of each MCV2 user.
    /// `amount` LP token amount the user has provided.
    /// `rewardDebt` The amount of Meuna entitled to the user.
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    /// @notice Info of each MCV2 pool.
    /// `allocPoint` The amount of allocation points assigned to the pool.
    /// Also known as the amount of Meuna to distribute per block.
    struct PoolInfo {
        IERC20 token;
        uint256 accMeunaPerShare;
        uint256 lastRewardTime;
        uint256 allocPoint;
        uint256 totalAmount;
        bool short;
    }

    /// @notice Address of Meuna contract.
    IERC20 public Meuna;
    address public shortContract;

    /// @notice Info of each MCV2 pool.
    PoolInfo[] public poolInfo;
    /// @notice Address of the LP token for each MCV2 pool.
    
    /// @notice Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    mapping (address => bool) public setter;
    /// @dev Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    uint256 public startTime;

    uint256 public MeunaPerSecond;
    uint256 private constant ACC_Meuna_PRECISION = 1e12;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event IncreaseShort(address indexed shortContract,address indexed user,uint256 indexed pid,uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event DecreaseShort(address indexed shortContract,address indexed user,uint256 indexed pid,uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
    event Harvest(address indexed user, uint256 indexed pid, uint256 amount);
    event LogUpdatePool(uint256 indexed pid, uint256 lastRewardTime, uint256 lpSupply, uint256 accMeunaPerShare);
    event LogMeunaPerSecond(uint256 MeunaPerSecond);
    event LogSetPool(uint256 indexed pid, uint256 allocPoint);
    event LogPoolAddition(uint256 indexed pid, uint256 allocPoint, IERC20 indexed token, bool types);

    /// @param _Meuna The Meuna token contract address.
    function initialize(IERC20 _Meuna,uint256 _startTime) public initializer {
        OwnableUpgradeable.__Ownable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        PausableUpgradeable.__Pausable_init();
        Meuna = _Meuna;
        startTime = _startTime;
    }

    function poolLength() public view returns (uint256 pools) {
        pools = poolInfo.length;
    }

    function updateWeight(uint256[] calldata pids,uint256[] calldata allocPoints) external {
        require(setter[msg.sender], "!setter");
        uint256 len = pids.length;
        for (uint256 i = 0; i < len; ++i) {
            updatePool(pids[i]);
        }
        for (uint256 j=0; j < len; ++j) {
            totalAllocPoint = totalAllocPoint.sub(poolInfo[pids[j]].allocPoint).add(allocPoints[j]);
            poolInfo[pids[j]].allocPoint = allocPoints[j];
            emit LogSetPool(pids[j], allocPoints[j]);
        }
    }

    function updatePerSec(uint256[] calldata pids,uint256 _MeunaPerSecond) external {
        require(setter[msg.sender], "!setter");
        uint256 len = pids.length;
        for (uint256 i = 0; i < len; ++i) {
            updatePool(pids[i]);
        }
        MeunaPerSecond = _MeunaPerSecond;
        emit LogMeunaPerSecond(_MeunaPerSecond);
    } 

    function updateWeightAndPerSec(uint256[] calldata pids,uint256 _MeunaPerSecond,uint256[] calldata allocPoints) external {
        require(setter[msg.sender], "!setter");
        uint256 len = pids.length;
        for (uint256 i = 0; i < len; ++i) {
            updatePool(pids[i]);
        }

        MeunaPerSecond = _MeunaPerSecond;
        emit LogMeunaPerSecond(_MeunaPerSecond);

        for (uint256 j=0; j < len; ++j) {
            totalAllocPoint = totalAllocPoint.sub(poolInfo[pids[j]].allocPoint).add(allocPoints[j]);
            poolInfo[pids[j]].allocPoint = allocPoints[j];
            emit LogSetPool(pids[j], allocPoints[j]);
        }
    }

    function add(IERC20 _token,uint256 _allocPoint,bool _shorts) public onlyOwner {
        uint256 lastRewardTime = block.timestamp > startTime ? block.timestamp : startTime;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                token : _token,
                allocPoint: _allocPoint,
                lastRewardTime: lastRewardTime,
                accMeunaPerShare: 0,
                totalAmount:0,
                short :_shorts
            })
        );
        emit LogPoolAddition(poolLength(), _allocPoint, _token,_shorts);
    }

    function set(uint256 _pid, uint256 _allocPoint) public onlyOwner {
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
        emit LogSetPool(_pid, _allocPoint);
    }

    function setMeunaPerSecond(uint256 _MeunaPerSecond) public onlyOwner {
        MeunaPerSecond = _MeunaPerSecond;
        emit LogMeunaPerSecond(_MeunaPerSecond);
    }

    function pendingMeuna(uint256 _pid, address _user) external view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accMeunaPerShare = pool.accMeunaPerShare;
        uint256 lpSupply = poolInfo[_pid].totalAmount;
        if (block.timestamp > pool.lastRewardTime && lpSupply != 0) {
            uint256 time = block.timestamp.sub(pool.lastRewardTime);
            uint256 MeunaReward = time.mul(MeunaPerSecond).mul(pool.allocPoint) / totalAllocPoint;
            accMeunaPerShare = accMeunaPerShare.add(MeunaReward.mul(ACC_Meuna_PRECISION) / lpSupply);
        }
        pending = user.amount.mul(accMeunaPerShare).div(ACC_Meuna_PRECISION).sub(user.rewardDebt);
    }

    function massUpdatePools(uint256[] calldata pids) external {
        uint256 len = pids.length;
        for (uint256 i = 0; i < len; ++i) {
            updatePool(pids[i]);
        }
    }

    function updatePool(uint256 pid) public {
        PoolInfo storage pool = poolInfo[pid];
        if (block.timestamp > pool.lastRewardTime) {
            uint256 lpSupply = pool.totalAmount;
            if (lpSupply > 0) {
                uint256 time = block.timestamp.sub(pool.lastRewardTime);
                uint256 MeunaReward = time.mul(MeunaPerSecond).mul(pool.allocPoint).div(totalAllocPoint);
                pool.accMeunaPerShare = pool.accMeunaPerShare.add((MeunaReward.mul(ACC_Meuna_PRECISION).div(lpSupply)));
            }
            pool.lastRewardTime = block.timestamp;
            emit LogUpdatePool(pid, pool.lastRewardTime, lpSupply, pool.accMeunaPerShare);
        }
    }

    function deposit(uint256 pid, uint256 amount) public whenNotPaused nonReentrant{
        updatePool(pid);
        PoolInfo storage pool = poolInfo[pid];
        require(!pool.short,"short token");
        UserInfo storage user = userInfo[pid][msg.sender];

        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accMeunaPerShare).div(ACC_Meuna_PRECISION).sub(user.rewardDebt);
            if (pending > 0) {
                safeMeunaTransfer(msg.sender, pending);
            }
        }

        if(amount>0){
            pool.token.safeTransferFrom(msg.sender, address(this), amount);
            user.amount = user.amount.add(amount);
            pool.totalAmount = pool.totalAmount.add(amount);
        }
        user.rewardDebt = user.amount.mul(pool.accMeunaPerShare).div(ACC_Meuna_PRECISION);
        emit Deposit(msg.sender, pid, amount);
    }

    function withdraw(uint256 pid, uint256 amount) public nonReentrant {
        updatePool(pid);
        PoolInfo storage pool = poolInfo[pid];
        require(!pool.short,"short token");
        UserInfo storage user = userInfo[pid][msg.sender];

        require(user.amount >= amount, "withdraw: not good");

        uint256 pending = user.amount.mul(pool.accMeunaPerShare).div(ACC_Meuna_PRECISION).sub(user.rewardDebt);
        if (pending > 0) {
            safeMeunaTransfer(msg.sender, pending);
        }

        if(amount>0){
            user.amount = user.amount.sub(amount);
            pool.totalAmount = pool.totalAmount.sub(amount);
            pool.token.safeTransfer(msg.sender, amount);
        }
        user.rewardDebt = user.amount.mul(pool.accMeunaPerShare).div(ACC_Meuna_PRECISION);  
        emit Withdraw(msg.sender, pid, amount);
    }

    function increaseShort(uint256 pid,uint256 amount,address to) public onlyShortContract {
        updatePool(pid);
        PoolInfo storage pool = poolInfo[pid];
        require(pool.short,"not short token");
        UserInfo storage user = userInfo[pid][to];

        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accMeunaPerShare).div(ACC_Meuna_PRECISION).sub(user.rewardDebt);
            if (pending > 0) {
                safeMeunaTransfer(to, pending);
            }
        }

        if(amount>0){
            user.amount = user.amount.add(amount);
            user.rewardDebt = user.rewardDebt.add(amount.mul(pool.accMeunaPerShare).div(ACC_Meuna_PRECISION));
            pool.totalAmount = pool.totalAmount.add(amount);
        }
        user.rewardDebt = user.amount.mul(pool.accMeunaPerShare).div(ACC_Meuna_PRECISION);
        emit IncreaseShort(msg.sender,to,pid,amount);
    } 

    function decreaseShort(uint256 pid,uint256 amount,address to) public onlyShortContract {
        updatePool(pid);
        PoolInfo storage pool = poolInfo[pid];
        require(pool.short,"not short token");
        UserInfo storage user = userInfo[pid][to];

        require(user.amount >= amount, "decrease: not good");

        uint256 pending = user.amount.mul(pool.accMeunaPerShare).div(ACC_Meuna_PRECISION).sub(user.rewardDebt);
        if (pending > 0) {
            safeMeunaTransfer(to, pending);
        }

        if(amount>0){
            user.amount = user.amount.sub(amount);
            pool.totalAmount = pool.totalAmount.sub(amount);
        }
        user.rewardDebt = user.amount.mul(pool.accMeunaPerShare).div(ACC_Meuna_PRECISION);  
        emit DecreaseShort(shortContract, to, pid, amount);
    }


    function harvest(uint256 pid) public whenNotPaused nonReentrant {
        updatePool(pid);
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][msg.sender];

        uint256 accumulatedMeuna = user.amount.mul(pool.accMeunaPerShare).div(ACC_Meuna_PRECISION);
        uint256 pending = accumulatedMeuna.sub(user.rewardDebt);

        user.rewardDebt = accumulatedMeuna;
        if (pending > 0) {
            safeMeunaTransfer(msg.sender, pending);
        }
        
        emit Harvest(msg.sender, pid, pending);
    }

    function safeMeunaTransfer(address _to, uint256 _MeunaAmt) internal {
        uint256 MeunaBal = IERC20(Meuna).balanceOf(address(this));
        require(MeunaBal >= _MeunaAmt,"out of token");
        IERC20(Meuna).transfer(_to, _MeunaAmt);
    }

    modifier onlyShortContract() {
        require(isShortContract(), "caller is not the short contract");
        _;
    }
    
    function isShortContract() public view returns (bool) {
        return msg.sender == shortContract;
    }

    function addSetter(address _setter) external onlyOwner {
        setter[_setter] = true;
    }

    function removeSetter(address _setter) external onlyOwner {
        setter[_setter] = false;
    }

    function setShortContract(address _shortContract) external onlyOwner {
        shortContract = _shortContract;
    }

    function pause() external onlyOwner whenNotPaused {
        _pause();
    }

    function unpause() external onlyOwner whenPaused {
        _unpause();
    }


}