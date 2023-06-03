const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  const { expect } = require("chai");
  const { ethers,upgrades } = require("hardhat");

  describe("Lock Test", function () {
    let deployer,user1,user2,minter;
    let stable;
    let Lock;
    before(async () => {
        [deployer, user1, user2,minter] = await ethers.getSigners();
        const ERC20Mock = await ethers.getContractFactory("MeunaAsset");
        Lock = await ethers.getContractFactory("LockUpgrade");
        stable = await ERC20Mock.deploy("Stable Mock test","sStable");
        await stable.addSetter(deployer.address);
        await stable.mint(minter.address,"1000000000000000000000");
    });

    it("Lock ",async function(){
        let locker = await upgrades.deployProxy(Lock, [604800,stable.address]);
        await locker.setShortContract(minter.address);
        await stable.connect(minter).transfer(locker.address, "100000000000000000000");
        await locker.connect(minter).lockPosition(1,user1.address);
        await stable.connect(minter).transfer(locker.address, "100000000000000000000");
        await locker.connect(minter).lockPosition(4,user1.address);
        await stable.connect(minter).transfer(locker.address, "100000000000000000000");
        await locker.connect(minter).lockPosition(3,user1.address);
        await stable.connect(minter).transfer(locker.address, "100000000000000000000");
        await locker.connect(minter).lockPosition(2,user1.address);
        await time.increase(time.duration.days(7));
        let balance = (await stable.balanceOf(user1.address)).toString()
        expect(balance).to.equal("0");
        let pos = await locker.positionBySize(user1.address,0,10);      
        console.log(pos); 
        await expect(locker.connect(user2).unlockPosition([1])).to.be.revertedWith("not owner");
        await locker.connect(user1).unlockPosition([1]);
        balance = (await stable.balanceOf(user1.address)).toString()
        expect(balance).to.equal("100000000000000000000");
        pos = await locker.positionBySize(user1.address,0,10);      
        console.log(pos); 
        await locker.connect(user1).unlockPosition([4,3]);
        balance = (await stable.balanceOf(user1.address)).toString()
        expect(balance).to.equal("300000000000000000000");
        pos = await locker.positionBySize(user1.address,0,10);      
        console.log(pos); 
        await locker.connect(user1).unlockPosition([2]);
        balance = (await stable.balanceOf(user1.address)).toString()
        expect(balance).to.equal("400000000000000000000");
        pos = await locker.positionBySize(user1.address,0,10); 
        let lockInfo = await locker.lockInfos(2);
        expect(lockInfo.lockAmount).to.equal("0");  
        console.log(pos); 
    });

    it("Cant lock Same Id",async function(){
        let locker = await upgrades.deployProxy(Lock, [604800,stable.address]);
        await locker.setShortContract(minter.address);
        await stable.connect(minter).transfer(locker.address, "100000000000000000000");
        await locker.connect(minter).lockPosition(1,user1.address);
        await stable.connect(minter).transfer(locker.address, "100000000000000000000");
        await expect(locker.connect(minter).lockPosition(1,user1.address)).to.be.revertedWith("id locked");
    })

    it("IncreaseLock",async function(){
        let locker = await upgrades.deployProxy(Lock, [604800,stable.address]);
        await locker.setShortContract(minter.address);
        await stable.connect(minter).transfer(locker.address, "100000000000000000000");
        await locker.connect(minter).lockPosition(1,user1.address);
        await stable.connect(minter).transfer(locker.address, "100000000000000000000");
        await locker.connect(minter).increaseLock(1,user1.address);
        let pos = await locker.positionBySize(user1.address,0,10);      
        console.log(pos); 
        let lockInfo = await locker.lockInfos(1);
        expect(lockInfo.lockAmount).to.equal("200000000000000000000");  
        await time.increase(time.duration.days(7));
        await locker.connect(user1).unlockPosition([1]);
        balance = (await stable.balanceOf(user1.address)).toString()
        expect(balance).to.equal("600000000000000000000");
        lockInfo = await locker.lockInfos(1);
        expect(lockInfo.lockAmount).to.equal("0");  
    })

    it("Release Lock ",async function(){
        let locker = await upgrades.deployProxy(Lock, [604800,stable.address]);
        await locker.setShortContract(minter.address);
        await stable.connect(minter).transfer(locker.address, "100000000000000000000");
        await locker.connect(minter).lockPosition(1,user1.address);
        await stable.connect(minter).transfer(locker.address, "100000000000000000000");
        await locker.connect(minter).lockPosition(2,user1.address);
        let pos = await locker.positionBySize(user1.address,0,10);      
        console.log(pos); 
        await locker.connect(minter).releasePosition(2);
        balance = (await stable.balanceOf(user1.address)).toString()
        expect(balance).to.equal("700000000000000000000");
        await time.increase(time.duration.days(7));
        await locker.connect(user1).unlockPosition([1]);
        balance = (await stable.balanceOf(user1.address)).toString()
        expect(balance).to.equal("800000000000000000000");
    })

});