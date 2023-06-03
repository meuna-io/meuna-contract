const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  const { expect } = require("chai");
  const { ethers,upgrades } = require("hardhat");

  describe("Staking Test", function () {
    let deployer,user1,user2,minter;
    let mapple,lp1;
    let Staking;
    let ShortContract;
    
    before(async () => {
        [deployer, user1, user2,minter,ShortContract] = await ethers.getSigners();
        const ERC20Mock = await ethers.getContractFactory("MeunaAsset");
        mapple = await ERC20Mock.deploy("Mapple","MAPPLE");
        lp1 = await ERC20Mock.deploy("lp mapple-hay","lpm-h")
        Staking = await ethers.getContractFactory("StakingContractUpgrade");
        mun = await ERC20Mock.deploy("Meuna token","MUN");
        await lp1.addSetter(deployer.address);
        await lp1.mint(user1.address,"10000000000000000000000");
        await lp1.mint(user2.address,"10000000000000000000000");
        await mun.addSetter(deployer.address);
    });

    it("Stake Increase and Decrease",async function(){
        let timenow = await time.latest();
        let staking = await upgrades.deployProxy(Staking, [mun.address,timenow]);
        await mun.mint(staking.address,"10000000000000000000000");
        await staking.add(mapple.address,20,true);
        await staking.addSetter(deployer.address);
        await staking.setMeunaPerSecond("10000000000000000");
        await staking.setShortContract(ShortContract.address)
        await staking.connect(ShortContract).increaseShort(0,"1000000000000000000000",user1.address);
        await time.increase(time.duration.days(7));
        await staking.connect(user1).harvest(0);
        let userInfo = await staking.userInfo(0,user1.address);
        expect(await userInfo.amount.toString()).to.equal("1000000000000000000000");
        let balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("6048010000000000000000");
        await time.increase(time.duration.hours(7));
        balance = await staking.pendingMeuna(0,user1.address);
        expect(balance).to.equal("252000000000000000000");
        await staking.connect(ShortContract).decreaseShort(0,"1000000000000000000000",user1.address);
        userInfo = await staking.userInfo(0,user1.address);
        expect(await userInfo.amount.toString()).to.equal("0");
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("6300020000000000000000");
        await time.increase(time.duration.hours(7));  
        balance = await staking.pendingMeuna(0,user1.address);
        expect(balance).to.equal("0");
        await staking.connect(user1).harvest(0);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("6300020000000000000000");
    });

    it("Stake by Deposit And Withdraw",async function(){
        let timenow = await time.latest();
        let staking = await upgrades.deployProxy(Staking, [mun.address,timenow]);
        await mun.mint(staking.address,"10000000000000000000000");
        await staking.add(mapple.address,20,true);
        await staking.add(lp1.address,20,false);
        await staking.addSetter(deployer.address);
        await staking.setMeunaPerSecond("10000000000000000");
        await staking.setShortContract(ShortContract.address);
        await lp1.connect(user1).approve(staking.address, "1000000000000000000000");
        await staking.connect(user1).deposit(1,"100000000000000000000");
        let userInfo = await staking.userInfo(1,user1.address);
        expect(await userInfo.amount.toString()).to.equal("100000000000000000000");
        await time.increase(time.duration.days(7));
        let balance = await staking.pendingMeuna(1,user1.address);
        console.log(balance); 
        expect(balance).to.equal("3024000000000000000000");
        await staking.connect(user1).harvest(1);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("9324025000000000000000");
        await time.increase(time.duration.days(1));
        balance = await staking.pendingMeuna(1,user1.address);
        expect(balance).to.equal("432000000000000000000");
        await staking.connect(user1).withdraw(1,"100000000000000000000");
        userInfo = await staking.userInfo(1,user1.address);
        expect(await userInfo.amount.toString()).to.equal("0");
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("9756030000000000000000");
        await time.increase(time.duration.hours(7));
        await staking.connect(user1).harvest(1);
        expect(balance).to.equal("9756030000000000000000");
        balance = await staking.pendingMeuna(1,user1.address);
        expect(balance).to.equal("0");
    }); 

    it("test mutiple pool and mutiple user",async function(){
        let timenow = await time.latest();
        let staking = await upgrades.deployProxy(Staking, [mun.address,timenow]);
        await mun.mint(staking.address,"20000000000000000000000");
        await staking.add(mapple.address,20,true);
        await staking.add(lp1.address,20,false);
        await staking.addSetter(deployer.address);
        await staking.setMeunaPerSecond("10000000000000000");
        await staking.setShortContract(ShortContract.address);
        await lp1.connect(user1).approve(staking.address, "1000000000000000000000");
        await staking.connect(ShortContract).increaseShort(0,"1000000000000000000000",user1.address);
        await staking.connect(user1).deposit(1,"100000000000000000000");
        let userInfo = await staking.userInfo(0,user1.address);
        expect(await userInfo.amount.toString()).to.equal("1000000000000000000000");
        userInfo = await staking.userInfo(1,user1.address);
        expect(await userInfo.amount.toString()).to.equal("100000000000000000000");
        await time.increase(time.duration.days(7));
        let balance = await staking.pendingMeuna(0,user1.address);
        expect(balance).to.equal("3024005000000000000000");
        balance = await staking.pendingMeuna(1,user1.address);
        expect(balance).to.equal("3024000000000000000000"); 
        await staking.connect(user1).harvest(0);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("12780040000000000000000");
        await staking.connect(user1).harvest(1);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("15804050000000000000000");
        await time.increase(time.duration.days(7));
        await staking.connect(ShortContract).decreaseShort(0,"1000000000000000000000",user1.address);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("18828060000000000000000");
        await staking.connect(user1).withdraw(1,"100000000000000000000");
        userInfo = await staking.userInfo(0,user1.address);
        expect(await userInfo.amount.toString()).to.equal("0");
        userInfo = await staking.userInfo(1,user1.address);
        expect(await userInfo.amount.toString()).to.equal("0");
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("21852070000000000000000");
        await time.increase(time.duration.days(7));
        balance = await staking.pendingMeuna(0,user1.address);
        expect(balance).to.equal("0");
        balance = await staking.pendingMeuna(1,user1.address);
        expect(balance).to.equal("0"); 
        await staking.connect(user1).harvest(0);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("21852070000000000000000");
        await staking.connect(user1).harvest(1);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("21852070000000000000000");
    });

    it("test change updateWeight function",async function(){
        let timenow = await time.latest();
        let staking = await upgrades.deployProxy(Staking, [mun.address,timenow]);
        await mun.mint(staking.address,"20000000000000000000000");
        await staking.add(mapple.address,20,true);
        await staking.add(lp1.address,20,false);
        await staking.addSetter(deployer.address);
        await staking.setMeunaPerSecond("10000000000000000");
        await staking.setShortContract(ShortContract.address);
        await lp1.connect(user1).approve(staking.address, "1000000000000000000000");
        await staking.connect(ShortContract).increaseShort(0,"1000000000000000000000",user1.address);
        await staking.connect(user1).deposit(1,"100000000000000000000");
        let userInfo = await staking.userInfo(0,user1.address);
        expect(await userInfo.amount.toString()).to.equal("1000000000000000000000");
        userInfo = await staking.userInfo(1,user1.address);
        expect(await userInfo.amount.toString()).to.equal("100000000000000000000");
        await time.increase(time.duration.days(7));
        let balance = await staking.pendingMeuna(0,user1.address);
        expect(balance).to.equal("3024005000000000000000");
        balance = await staking.pendingMeuna(1,user1.address);
        expect(balance).to.equal("3024000000000000000000"); 
        await staking.connect(user1).harvest(0);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("24876080000000000000000");
        await staking.connect(user1).harvest(1);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("27900090000000000000000");
        await staking.updateWeight([0,1],[40,10]);
        await time.increase(time.duration.days(7));
        balance = await staking.pendingMeuna(0,user1.address);
        expect(balance).to.equal("4838410000000000000000");
        balance = await staking.pendingMeuna(1,user1.address);
        expect(balance).to.equal("1209605000000000000000"); 
        await staking.connect(user1).harvest(0);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("32738508000000000000000");
        await staking.connect(user1).harvest(1);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("33948117000000000000000");
    });

    it("test change updatePerSec function",async function(){
        let timenow = await time.latest();
        let staking = await upgrades.deployProxy(Staking, [mun.address,timenow]);
        await mun.mint(staking.address,"200000000000000000000000");
        await staking.add(mapple.address,20,true);
        await staking.add(lp1.address,20,false);
        await staking.addSetter(deployer.address);
        await staking.setMeunaPerSecond("10000000000000000");
        await staking.setShortContract(ShortContract.address);
        await lp1.connect(user1).approve(staking.address, "1000000000000000000000");
        await staking.connect(ShortContract).increaseShort(0,"1000000000000000000000",user1.address);
        await staking.connect(user1).deposit(1,"100000000000000000000");
        await time.increase(time.duration.days(7));
        let userInfo = await staking.userInfo(0,user1.address);
        expect(await userInfo.amount.toString()).to.equal("1000000000000000000000");
        userInfo = await staking.userInfo(1,user1.address);
        expect(await userInfo.amount.toString()).to.equal("100000000000000000000");
        let balance = await staking.pendingMeuna(0,user1.address);
        expect(balance).to.equal("3024005000000000000000");
        balance = await staking.pendingMeuna(1,user1.address);
        expect(balance).to.equal("3024000000000000000000"); 
        await staking.connect(user1).harvest(0);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("36972127000000000000000");
        await staking.connect(user1).harvest(1);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("39996137000000000000000");
        await staking.updatePerSec([0,1],"100000000000000000");
        await time.increase(time.duration.days(7));
        balance = await staking.pendingMeuna(0,user1.address);
        expect(balance).to.equal("30240010000000000000000");
        balance = await staking.pendingMeuna(1,user1.address);
        expect(balance).to.equal("30240005000000000000000"); 
        await staking.connect(user1).harvest(0);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("70236197000000000000000");
        await staking.connect(user1).harvest(1);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("100476302000000000000000");
    });                           

    it("test change updateWeightAndPerSec function",async function(){
        let timenow = await time.latest();
        let staking = await upgrades.deployProxy(Staking, [mun.address,timenow]);
        await mun.mint(staking.address,"200000000000000000000000");
        await staking.add(mapple.address,20,true);
        await staking.add(lp1.address,20,false);
        await staking.addSetter(deployer.address);
        await staking.setMeunaPerSecond("10000000000000000");
        await staking.setShortContract(ShortContract.address);
        await lp1.connect(user1).approve(staking.address, "1000000000000000000000");
        await staking.connect(ShortContract).increaseShort(0,"1000000000000000000000",user1.address);
        await staking.connect(user1).deposit(1,"100000000000000000000");
        await time.increase(time.duration.days(7));
        let userInfo = await staking.userInfo(0,user1.address);
        expect(await userInfo.amount.toString()).to.equal("1000000000000000000000");
        userInfo = await staking.userInfo(1,user1.address);
        expect(await userInfo.amount.toString()).to.equal("100000000000000000000");
        let balance = await staking.pendingMeuna(0,user1.address);
        expect(balance).to.equal("3024005000000000000000");
        balance = await staking.pendingMeuna(1,user1.address);
        expect(balance).to.equal("3024000000000000000000"); 
        await staking.connect(user1).harvest(0);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("103500312000000000000000");
        await staking.connect(user1).harvest(1);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("106524322000000000000000");
        await staking.updateWeightAndPerSec([0,1],"100000000000000000",[40,10]);
        await time.increase(time.duration.days(7));
        balance = await staking.pendingMeuna(0,user1.address);
        expect(balance).to.equal("48384010000000000000000");
        balance = await staking.pendingMeuna(1,user1.address);
        expect(balance).to.equal("12096005000000000000000"); 
        await staking.connect(user1).harvest(0);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("154908412000000000000000");
        await staking.connect(user1).harvest(1);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("167004457000000000000000");
    });

    it("test mutiple user function",async function(){
        let timenow = await time.latest();
        let staking = await upgrades.deployProxy(Staking, [mun.address,timenow]);
        await mun.mint(staking.address,"200000000000000000000000");
        await staking.add(mapple.address,20,true);
        await staking.add(lp1.address,20,false);
        await staking.addSetter(deployer.address);
        await staking.setMeunaPerSecond("10000000000000000");
        await staking.setShortContract(ShortContract.address);
        await lp1.connect(user1).approve(staking.address, "1000000000000000000000");
        await lp1.connect(user2).approve(staking.address, "1000000000000000000000");
        await staking.connect(ShortContract).increaseShort(0,"1000000000000000000000",user1.address);
        await staking.connect(user1).deposit(1,"100000000000000000000");
        await staking.connect(ShortContract).increaseShort(0,"1000000000000000000000",user2.address);
        await staking.connect(user2).deposit(1,"100000000000000000000");
        let userInfo = await staking.userInfo(0,user1.address);
        expect(await userInfo.amount.toString()).to.equal("1000000000000000000000");
        userInfo = await staking.userInfo(1,user1.address);
        expect(await userInfo.amount.toString()).to.equal("100000000000000000000");
        userInfo = await staking.userInfo(0,user2.address);
        expect(await userInfo.amount.toString()).to.equal("1000000000000000000000");
        userInfo = await staking.userInfo(1,user2.address);
        expect(await userInfo.amount.toString()).to.equal("100000000000000000000");
        await time.increase(time.duration.days(7));
        let balance = await staking.pendingMeuna(0,user1.address);
        expect(balance).to.equal("1512012500000000000000");
        balance = await staking.pendingMeuna(1,user1.address);
        expect(balance).to.equal("1512010000000000000000");
        balance = await staking.pendingMeuna(0,user2.address);
        expect(balance).to.equal("1512002500000000000000");
        balance = await staking.pendingMeuna(1,user2.address);
        expect(balance).to.equal("1512000000000000000000");
        await staking.connect(user1).harvest(0);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("168516472000000000000000");
        await staking.connect(user1).harvest(1);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("170028487000000000000000");
        await staking.connect(user2).harvest(0);
        balance = (await mun.balanceOf(user2.address)).toString()
        expect(balance).to.equal("1512010000000000000000");
        await staking.connect(user2).harvest(1);
        balance = (await mun.balanceOf(user2.address)).toString()
        expect(balance).to.equal("3024020000000000000000");
        await time.increase(time.duration.days(7));
        await staking.connect(ShortContract).decreaseShort(0,"1000000000000000000000",user1.address);
        await staking.connect(ShortContract).decreaseShort(0,"1000000000000000000000",user2.address);
        userInfo = await staking.userInfo(0,user1.address);
        expect(await userInfo.amount.toString()).to.equal("0");
        userInfo = await staking.userInfo(0,user2.address);
        expect(await userInfo.amount.toString()).to.equal("0");
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("171540497000000000000000");
        balance = (await mun.balanceOf(user2.address)).toString()
        expect(balance).to.equal("4536030000000000000000");
        await staking.connect(user1).withdraw(1,"100000000000000000000");
        await staking.connect(user2).withdraw(1,"100000000000000000000");
        userInfo = await staking.userInfo(1,user1.address);
        expect(await userInfo.amount.toString()).to.equal("0");
        userInfo = await staking.userInfo(1,user2.address);
        expect(await userInfo.amount.toString()).to.equal("0");
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("173052509500000000000000");
        balance = (await mun.balanceOf(user2.address)).toString()
        expect(balance).to.equal("6048042500000000000000");
        await time.increase(time.duration.days(7));
        balance = await staking.pendingMeuna(0,user1.address);
        expect(balance).to.equal("0");
        balance = await staking.pendingMeuna(1,user1.address);
        expect(balance).to.equal("0"); 
        balance = await staking.pendingMeuna(0,user2.address);
        expect(balance).to.equal("0");
        balance = await staking.pendingMeuna(1,user2.address);
        expect(balance).to.equal("0"); 
        await staking.connect(user1).harvest(0);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("173052509500000000000000");
        await staking.connect(user1).harvest(1);
        balance = (await mun.balanceOf(user1.address)).toString()
        expect(balance).to.equal("173052509500000000000000");
        balance = (await mun.balanceOf(user2.address)).toString()
        expect(balance).to.equal("6048042500000000000000");
        await staking.connect(user2).harvest(1);
        balance = (await mun.balanceOf(user2.address)).toString()
        expect(balance).to.equal("6048042500000000000000");
    });
});