const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  const { expect } = require("chai");
  const { ethers,upgrades } = require("hardhat");

  describe("Postion Test", function () {
    let deployer,user1,user2,collector,collector2,weth,addLp;
    let stable,asset00,asset01;
    let assetConfig,collateralConfig,MintSynUpgrade;
    let Lock,ShortContract,StakingContract;
    let Factory,Router,Lp;
    before(async () => {
        [deployer, user1, user2,collector,collector2,weth,addLp] = await ethers.getSigners();
        const ERC20Mock = await ethers.getContractFactory("MeunaAsset");
        const Oracle = await ethers.getContractFactory("PriceOracle");
        const AssetConfig = await ethers.getContractFactory("AssetConfig");
        Lock = await ethers.getContractFactory("LockUpgrade");
        ShortContract = await ethers.getContractFactory("ShortContractUpgrade");
        StakingContract = await ethers.getContractFactory("StakingContractUpgrade");
        Factory = await  ethers.getContractFactory("PancakeFactory");
        Router = await  ethers.getContractFactory("PancakeRouterV2");
        Lp = await  ethers.getContractFactory("PancakePair");
        const CollateralConfig = await ethers.getContractFactory("CollateralConfig");
        MintSynUpgrade = await ethers.getContractFactory("MintSynUpgrade");
        asset00 = await ERC20Mock.deploy("Meuna APPLE","mAPPLE");
        asset01 = await ERC20Mock.deploy("Meuna TESLA","mTESLA");
        stable = await ERC20Mock.deploy("Stable Mock test","sStable");
        mun = await ERC20Mock.deploy("Meuna token","MUN");
        await mun.addSetter(deployer.address);
        await stable.addSetter(deployer.address);
        await asset00.addSetter(deployer.address);
        await asset01.addSetter(deployer.address);
        await asset01.mint(user1.address,"20000000000000000000000");
        await asset00.mint(user1.address,"20000000000000000000000");
        await asset00.mint(user2.address,"7000000000000000000");
        await asset00.mint(addLp.address,"10000000000000000000000");
        await asset01.mint(addLp.address,"10000000000000000000000");
        await stable.mint(addLp.address,"1000000000000000000000000");
     
        oracle = await Oracle.deploy();
        assetConfig = await AssetConfig.deploy();
        collateralConfig = await CollateralConfig.deploy();
    });

    it("Open Short Position",async function(){
        let factory = await Factory.deploy(collector.address);
        let router = await Router.deploy(factory.address,weth.address);
        await stable.connect(addLp).approve(router.address,"1000000000000000000000000");
        await asset00.connect(addLp).approve(router.address,"1000000000000000000000000");
        await asset01.connect(addLp).approve(router.address,"1000000000000000000000000");
        await time.increase(time.duration.days(7));
        let timenow = await time.latest();
        
        let timeStamp = (await ethers.provider.getBlock("latest")).timestamp
        console.log("----------------------------------------",timeStamp+100)
        await router.connect(addLp).addLiquidity(stable.address,asset00.address,"150000000000000000000000","1000000000000000000000",0,0,addLp.address,timeStamp+100);
        
        let lpAddressAsset0 = await factory.getPair(asset00.address,stable.address);
        console.log("--------------------------------",lpAddressAsset0);
        await stable.mint(user1.address,"2000000000000000000000");
        await oracle.setPrices([asset00.address,asset01.address,stable.address],["100000000000000000000",
        "50000000000000000000","1000000000000000000"]);
        
        let locker = await upgrades.deployProxy(Lock, [604800,stable.address]);
        let staking =  await upgrades.deployProxy(StakingContract, [mun.address,timenow]);
        await staking.addSetter(deployer.address);
        await staking.setMeunaPerSecond("10000000000000000");
        await staking.add(lpAddressAsset0,20,false);
        await staking.add(asset00.address,20,true);
        await mun.mint(staking.address,"10000000000000000000000");
        
        let short = await upgrades.deployProxy(ShortContract, [factory.address,router.address,locker.address,staking.address]);
        await short.setAssetPool(asset00.address,1);
        await locker.setShortContract(short.address);
        await staking.setShortContract(short.address);

        let mintSynTest3 = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector.address]);
        
        await mintSynTest3.setShortContract(short.address);
        await short.setMintContract(mintSynTest3.address);
        await asset00.addSetter(mintSynTest3.address);
        await stable.connect(user1).approve(mintSynTest3.address, "1000000000000000000000");
    
        await expect(mintSynTest3.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",true)).to.be.revertedWith("this asset not allowed");
        await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","150000000000000000000",true]]);
        await assetConfig.setConfigs([asset01.address],[["mTESLA","20000000000000000000","150000000000000000000",true]]);
        await expect(mintSynTest3.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",true)).to.be.revertedWith("this collateral not allowed");
        await collateralConfig.setConfigs([stable.address,asset01.address],[["stableMock","100000",true],["asset01","200000",true]])
        
        //open asset00 with stable
        //open position 140 ratio min 150
        await expect(mintSynTest3.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"140000000000000000000",true)).to.be.revertedWith("low collateral ratio than minimum");
    
        //open postion 150 ratio pass
        await mintSynTest3.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",true);
        let pos = await mintSynTest3.positions(1);
        expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
        expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
        expect(await pos.asset.toString()).to.equal(asset00.address);
        expect(await pos.collateral.toString()).to.equal(stable.address);
        expect(await pos.owner.toString()).to.equal(user1.address);
        expect(await pos.short).to.equal(true);
        
        let lockPos = await  locker.lockInfos(1);
        expect(lockPos.lockAmount).to.equal("990910445537177767745");  
        let stakePos =  await staking.userInfo(1,user1.address);
        expect(await stakePos.amount.toString()).to.equal("6666666666666666666");
    
      })

      it("Mint Short Position",async function(){
        let factory = await Factory.deploy(collector.address);
        let router = await Router.deploy(factory.address,weth.address);
        await stable.connect(addLp).approve(router.address,"1000000000000000000000000");
        await asset00.connect(addLp).approve(router.address,"1000000000000000000000000");
        await asset01.connect(addLp).approve(router.address,"1000000000000000000000000");
        await time.increase(time.duration.days(7));
        let timenow = await time.latest();
        
        let timeStamp = (await ethers.provider.getBlock("latest")).timestamp
        console.log("----------------------------------------",timeStamp+100)
        await router.connect(addLp).addLiquidity(stable.address,asset00.address,"150000000000000000000000","1000000000000000000000",0,0,addLp.address,timeStamp+100);
        
        let lpAddressAsset0 = await factory.getPair(asset00.address,stable.address);
        console.log("--------------------------------",lpAddressAsset0);
        await stable.mint(user1.address,"2000000000000000000000");
        await oracle.setPrices([asset00.address,asset01.address,stable.address],["100000000000000000000",
        "50000000000000000000","1000000000000000000"]);
        
        let locker = await upgrades.deployProxy(Lock, [604800,stable.address]);
        let staking =  await upgrades.deployProxy(StakingContract, [mun.address,timenow]);
        await staking.addSetter(deployer.address);
        await staking.setMeunaPerSecond("10000000000000000");
        await staking.add(lpAddressAsset0,20,false);
        await staking.add(asset00.address,20,true);
        await mun.mint(staking.address,"10000000000000000000000");

        let short = await upgrades.deployProxy(ShortContract, [factory.address,router.address,locker.address,staking.address]);
        await short.setAssetPool(asset00.address,1);
        await locker.setShortContract(short.address);
        await staking.setShortContract(short.address);

        let mintSynTest3 = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector.address]);
        
        await mintSynTest3.setShortContract(short.address);
        await short.setMintContract(mintSynTest3.address);
        await asset00.addSetter(mintSynTest3.address);
        await stable.connect(user1).approve(mintSynTest3.address, "1000000000000000000000");
        
        await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","150000000000000000000",true]]);
        await assetConfig.setConfigs([asset01.address],[["mTESLA","20000000000000000000","150000000000000000000",true]]);
        await collateralConfig.setConfigs([stable.address,asset01.address],[["stableMock","100000",true],["asset01","200000",true]])
        
        //open postion 150 ratio pass
        await mintSynTest3.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"200000000000000000000",true);
        let pos = await mintSynTest3.positions(1);
        expect(await pos.mintAmount.toString()).to.equal("5000000000000000000");
        expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
        expect(await pos.asset.toString()).to.equal(asset00.address);
        expect(await pos.collateral.toString()).to.equal(stable.address);
        expect(await pos.owner.toString()).to.equal(user1.address);
        expect(await pos.short).to.equal(true);
        
        let lockPos = await  locker.lockInfos(1);
        expect(lockPos.lockAmount).to.equal("744412243933382255998");  
        let stakePos =  await staking.userInfo(1,user1.address);
        expect(await stakePos.amount.toString()).to.equal("5000000000000000000");

        await mintSynTest3.connect(user1).mintAsset(1,"1000000000000000000");

        lockPos = await locker.lockInfos(1);
        expect(lockPos.lockAmount).to.equal("892407093609128419581");  
        stakePos =  await staking.userInfo(1,user1.address);
        expect(await stakePos.amount.toString()).to.equal("6000000000000000000");
      
      });

      it("Burn Short Position",async function(){
        let factory = await Factory.deploy(collector.address);
        let router = await Router.deploy(factory.address,weth.address);
        await stable.connect(addLp).approve(router.address,"1000000000000000000000000");
        await asset00.connect(addLp).approve(router.address,"1000000000000000000000000");
        await asset01.connect(addLp).approve(router.address,"1000000000000000000000000");
        await time.increase(time.duration.days(7));
        let timenow = await time.latest();
        
        let timeStamp = (await ethers.provider.getBlock("latest")).timestamp
        console.log("----------------------------------------",timeStamp+100)
        await router.connect(addLp).addLiquidity(stable.address,asset00.address,"150000000000000000000000","1000000000000000000000",0,0,addLp.address,timeStamp+100);
        
        let lpAddressAsset0 = await factory.getPair(asset00.address,stable.address);
        console.log("--------------------------------",lpAddressAsset0);
        await stable.mint(user1.address,"2000000000000000000000");
        await oracle.setPrices([asset00.address,asset01.address,stable.address],["100000000000000000000",
        "50000000000000000000","1000000000000000000"]);
        
        let locker = await upgrades.deployProxy(Lock, [604800,stable.address]);
        let staking =  await upgrades.deployProxy(StakingContract, [mun.address,timenow]);
        await staking.addSetter(deployer.address);
        await staking.setMeunaPerSecond("10000000000000000");
        await staking.add(lpAddressAsset0,20,false);
        await staking.add(asset00.address,20,true);
        await mun.mint(staking.address,"10000000000000000000000");

        let short = await upgrades.deployProxy(ShortContract, [factory.address,router.address,locker.address,staking.address]);
        await short.setAssetPool(asset00.address,1);
        await locker.setShortContract(short.address);
        await staking.setShortContract(short.address);

        let mintSynTest3 = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector.address]);
        
        await mintSynTest3.setShortContract(short.address);
        await short.setMintContract(mintSynTest3.address);
        await asset00.addSetter(mintSynTest3.address);
        await stable.connect(user1).approve(mintSynTest3.address, "1000000000000000000000");
        
        await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","150000000000000000000",true]]);
        await assetConfig.setConfigs([asset01.address],[["mTESLA","20000000000000000000","150000000000000000000",true]]);
        await collateralConfig.setConfigs([stable.address,asset01.address],[["stableMock","100000",true],["asset01","200000",true]])
        
        //open postion 150 ratio pass
        await mintSynTest3.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"200000000000000000000",true);
        let pos = await mintSynTest3.positions(1);
        expect(await pos.mintAmount.toString()).to.equal("5000000000000000000");
        expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
        expect(await pos.asset.toString()).to.equal(asset00.address);
        expect(await pos.collateral.toString()).to.equal(stable.address);
        expect(await pos.owner.toString()).to.equal(user1.address);
        expect(await pos.short).to.equal(true);

        let lockPos = await  locker.lockInfos(1);
        expect(lockPos.lockAmount).to.equal("744412243933382255998");  
        let stakePos =  await staking.userInfo(1,user1.address);
        expect(await stakePos.amount.toString()).to.equal("5000000000000000000");

        await asset00.connect(user1).approve(mintSynTest3.address, "2000000000000000000000");
        await mintSynTest3.connect(user1).burnAsset(1,"1000000000000000000");

        lockPos = await  locker.lockInfos(1);
        expect(lockPos.lockAmount).to.equal("744412243933382255998");  
        stakePos =  await staking.userInfo(1,user1.address);
        expect(await stakePos.amount.toString()).to.equal("4000000000000000000");

      });

      it("Auction Short Position",async function(){
        let factory = await Factory.deploy(collector.address);
        let router = await Router.deploy(factory.address,weth.address);
        await stable.connect(addLp).approve(router.address,"1000000000000000000000000");
        await asset00.connect(addLp).approve(router.address,"1000000000000000000000000");
        await asset01.connect(addLp).approve(router.address,"1000000000000000000000000");
        await time.increase(time.duration.days(7));
        let timenow = await time.latest();
        
        let timeStamp = (await ethers.provider.getBlock("latest")).timestamp
        console.log("----------------------------------------",timeStamp+100)
        await router.connect(addLp).addLiquidity(stable.address,asset00.address,"150000000000000000000000","1000000000000000000000",0,0,addLp.address,timeStamp+100);
        
        let lpAddressAsset0 = await factory.getPair(asset00.address,stable.address);
        console.log("--------------------------------",lpAddressAsset0);
        await stable.mint(user1.address,"2000000000000000000000");
        await oracle.setPrices([asset00.address,asset01.address,stable.address],["100000000000000000000",
        "50000000000000000000","1000000000000000000"]);
        
        let locker = await upgrades.deployProxy(Lock, [604800,stable.address]);
        let staking =  await upgrades.deployProxy(StakingContract, [mun.address,timenow]);
        await staking.addSetter(deployer.address);
        await staking.setMeunaPerSecond("10000000000000000");
        await staking.add(lpAddressAsset0,20,false);
        await staking.add(asset00.address,20,true);
        await mun.mint(staking.address,"10000000000000000000000");

        let short = await upgrades.deployProxy(ShortContract, [factory.address,router.address,locker.address,staking.address]);
        await short.setAssetPool(asset00.address,1);
        await locker.setShortContract(short.address);
        await staking.setShortContract(short.address);

        let mintSynTest3 = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector.address]);
        
        await mintSynTest3.setShortContract(short.address);
        await short.setMintContract(mintSynTest3.address);
        await asset00.addSetter(mintSynTest3.address);
        await stable.connect(user1).approve(mintSynTest3.address, "1000000000000000000000");
        
        await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","150000000000000000000",true]]);
        await assetConfig.setConfigs([asset01.address],[["mTESLA","20000000000000000000","150000000000000000000",true]]);
        await collateralConfig.setConfigs([stable.address,asset01.address],[["stableMock","100000",true],["asset01","200000",true]])
        
        //open postion 150 ratio pass
        await mintSynTest3.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",true);
        let pos = await mintSynTest3.positions(1);
        expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
        expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
        expect(await pos.asset.toString()).to.equal(asset00.address);
        expect(await pos.collateral.toString()).to.equal(stable.address);
        expect(await pos.owner.toString()).to.equal(user1.address);
        expect(await pos.short).to.equal(true);

          
        let lockPos = await  locker.lockInfos(1);
        expect(lockPos.lockAmount).to.equal("990910445537177767745");  
        let stakePos =  await staking.userInfo(1,user1.address);
        expect(await stakePos.amount.toString()).to.equal("6666666666666666666");
        
        await oracle.setPrices([asset00.address,asset01.address,stable.address],["115000000000000000000",
        "50000000000000000000","1000000000000000000"]);
        await asset00.connect(user2).approve(mintSynTest3.address, "2000000000000000000000");
        await mintSynTest3.connect(user2).auction(1,"1000000000000000000");

        lockPos = await  locker.lockInfos(1);
        expect(lockPos.lockAmount).to.equal("990910445537177767745");  
        stakePos =  await staking.userInfo(1,user1.address);
        expect(await stakePos.amount.toString()).to.equal("5666666666666666666");

        await mintSynTest3.connect(user2).auction(1,"5666666666666666666");
        pos = await mintSynTest3.positions(1);
        expect(await pos.mintAmount.toString()).to.equal("0");
        expect(await pos.collateralAmount.toString()).to.equal("0");
        expect(await pos.asset.toString()).to.equal(asset00.address);
        expect(await pos.collateral.toString()).to.equal(stable.address);
        expect(await pos.owner.toString()).to.equal(user1.address);
        expect(await pos.short).to.equal(true);
        expect(await pos.closePosition).to.equal(true);

        lockPos = await  locker.lockInfos(1);
        expect(lockPos.lockAmount).to.equal("0");  
        stakePos =  await staking.userInfo(1,user1.address);
        expect(await stakePos.amount.toString()).to.equal("0");

      });

      it("Close Position",async function(){
        let factory = await Factory.deploy(collector.address);
        let router = await Router.deploy(factory.address,weth.address);
        await stable.connect(addLp).approve(router.address,"1000000000000000000000000");
        await asset00.connect(addLp).approve(router.address,"1000000000000000000000000");
        await asset01.connect(addLp).approve(router.address,"1000000000000000000000000");
        await time.increase(time.duration.days(7));
        let timenow = await time.latest();
        
        let timeStamp = (await ethers.provider.getBlock("latest")).timestamp
        console.log("----------------------------------------",timeStamp+100)
        await router.connect(addLp).addLiquidity(stable.address,asset00.address,"150000000000000000000000","1000000000000000000000",0,0,addLp.address,timeStamp+100);
        
        let lpAddressAsset0 = await factory.getPair(asset00.address,stable.address);
        console.log("--------------------------------",lpAddressAsset0);
        await stable.mint(user1.address,"2000000000000000000000");
        await oracle.setPrices([asset00.address,asset01.address,stable.address],["100000000000000000000",
        "50000000000000000000","1000000000000000000"]);
        
        let locker = await upgrades.deployProxy(Lock, [604800,stable.address]);
        let staking =  await upgrades.deployProxy(StakingContract, [mun.address,timenow]);
        await staking.addSetter(deployer.address);
        await staking.setMeunaPerSecond("10000000000000000");
        await staking.add(lpAddressAsset0,20,false);
        await staking.add(asset00.address,20,true);
        await mun.mint(staking.address,"10000000000000000000000");
         
        let short = await upgrades.deployProxy(ShortContract, [factory.address,router.address,locker.address,staking.address]);
        await short.setAssetPool(asset00.address,1);
        await locker.setShortContract(short.address);
        await staking.setShortContract(short.address);

        let mintSynTest3 = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector.address]);
        
        await mintSynTest3.setShortContract(short.address);
        await short.setMintContract(mintSynTest3.address);
        await asset00.addSetter(mintSynTest3.address);
        await stable.connect(user1).approve(mintSynTest3.address, "1000000000000000000000");
        
        await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","150000000000000000000",true]]);
        await assetConfig.setConfigs([asset01.address],[["mTESLA","20000000000000000000","150000000000000000000",true]]);
        await collateralConfig.setConfigs([stable.address,asset01.address],[["stableMock","100000",true],["asset01","200000",true]])
        
        //open postion 150 ratio pass
        await mintSynTest3.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",true);
        let pos = await mintSynTest3.positions(1);
        expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
        expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
        expect(await pos.asset.toString()).to.equal(asset00.address);
        expect(await pos.collateral.toString()).to.equal(stable.address);
        expect(await pos.owner.toString()).to.equal(user1.address);
        expect(await pos.short).to.equal(true);

        let lockPos = await  locker.lockInfos(1);
        expect(lockPos.lockAmount).to.equal("990910445537177767745");  
        let stakePos =  await staking.userInfo(1,user1.address);
        expect(await stakePos.amount.toString()).to.equal("6666666666666666666");

        await asset00.connect(user1).approve(mintSynTest3.address, "2000000000000000000000");
        await mintSynTest3.connect(user1).burnAsset(1,"6666666666666666666");

        lockPos = await  locker.lockInfos(1);
        expect(lockPos.lockAmount).to.equal("990910445537177767745");  
        stakePos =  await staking.userInfo(1,user1.address);
        expect(await stakePos.amount.toString()).to.equal("0");
        pos = await mintSynTest3.positions(1);
        expect(await pos.closePosition).to.equal(false);
        expect(await pos.collateralAmount.toString()).to.equal("993333333333333333334");

        await mintSynTest3.connect(user1).withdraw(1,"993333333333333333334");
        pos = await mintSynTest3.positions(1);
        expect(await pos.mintAmount.toString()).to.equal("0");
        expect(await pos.collateralAmount.toString()).to.equal("0");
        expect(await pos.asset.toString()).to.equal(asset00.address);
        expect(await pos.collateral.toString()).to.equal(stable.address);
        expect(await pos.owner.toString()).to.equal(user1.address);
        expect(await pos.short).to.equal(true);
        expect(await pos.closePosition).to.equal(true);

        lockPos = await  locker.lockInfos(1);
        expect(lockPos.lockAmount).to.equal("0");  


      });

});