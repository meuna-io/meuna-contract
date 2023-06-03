const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers,upgrades } = require("hardhat");

describe("Postion Test", function () {
  let deployer,user1,user2,collector,collector2;
  let stable,asset00,asset01;
  let assetConfig,collateralConfig,MintSynUpgrade;
  before(async () => {
    [deployer, user1, user2,collector,collector2] = await ethers.getSigners();
    const ERC20Mock = await ethers.getContractFactory("MeunaAsset");
    const Oracle = await ethers.getContractFactory("PriceOracle");
    const AssetConfig = await ethers.getContractFactory("AssetConfig");
    const CollateralConfig = await ethers.getContractFactory("CollateralConfig");
    MintSynUpgrade = await ethers.getContractFactory("MintSynUpgrade");
    asset00 = await ERC20Mock.deploy("Meuna APPLE","mAPPLE");
    asset01 = await ERC20Mock.deploy("Meuna TESLA","mTESLA");
    stable = await ERC20Mock.deploy("Stable Mock test","sStable");
    await stable.addSetter(deployer.address);
    await asset00.addSetter(deployer.address);
    await asset01.addSetter(deployer.address);
    await asset01.mint(user1.address,"20000000000000000000000");
    await asset00.mint(user2.address,"7000000000000000000");
    oracle = await Oracle.deploy();
    assetConfig = await AssetConfig.deploy();
    collateralConfig = await CollateralConfig.deploy();
  });

  it("Open Position",async function(){
    await stable.mint(user1.address,"2000000000000000000000");
    await oracle.setPrices([asset00.address,asset01.address,stable.address],["100000000000000000000",
    "50000000000000000000","1000000000000000000"]);

    let mintSynTest = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector.address]);
    await asset00.addSetter(mintSynTest.address);
    await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");

    await expect(mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",false)).to.be.revertedWith("this asset not allowed");
    await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","150000000000000000000",true]]);
    await assetConfig.setConfigs([asset01.address],[["mTESLA","20000000000000000000","150000000000000000000",true]]);
    await expect(mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",false)).to.be.revertedWith("this collateral not allowed");
    await collateralConfig.setConfigs([stable.address,asset01.address],[["stableMock","100000",true],["asset01","200000",true]])
    
    //open asset00 with stable
    //open position 140 ratio min 150
    await expect(mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"140000000000000000000",false)).to.be.revertedWith("low collateral ratio than minimum");

    //open postion 150 ratio pass
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",false);
    let pos = await mintSynTest.positions(1);
    expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    await asset01.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    //open asset00 with asset01
    await expect(mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,asset01.address,"150000000000000000000",false)).to.be.revertedWith("low collateral ratio than minimum");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,asset01.address,"300000000000000000000",false);
    pos = await mintSynTest.positions(2);
    expect(await pos.mintAmount.toString()).to.equal("166666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(asset01.address);
    expect(await pos.owner.toString()).to.equal(user1.address);
  })

  it("Deposit Position",async function(){
    await stable.mint(user1.address,"2000000000000000000000");
    await oracle.setPrices([asset00.address,asset01.address,stable.address],["100000000000000000000",
    "50000000000000000000","1000000000000000000"]);
    await collateralConfig.setConfigs([stable.address,asset01.address],[["stableMock","100000",true],["asset01","100000",true]])
    await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","150000000000000000000",true]]);
    await assetConfig.setConfigs([asset01.address],[["mTESLA","20000000000000000000","150000000000000000000",true]]);
    let mintSynTest = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector.address]);
    await asset00.addSetter(mintSynTest.address);
    //open asset00 with stable
    await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",false);
    let pos = await mintSynTest.positions(1);
    expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    await asset01.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,asset01.address,"150000000000000000000",false);
    pos = await mintSynTest.positions(2);
    expect(await pos.mintAmount.toString()).to.equal("333333333333333333333");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(asset01.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    //deposit position1 
    await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).deposit(1,"1000000000000000000000");
    pos = await mintSynTest.positions(1);
    expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("2000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    // deposit not owner
    await stable.mint(user2.address,"1000000000000000000000");
    await stable.connect(user2).approve(mintSynTest.address, "1000000000000000000000");
    await expect(mintSynTest.connect(user2).deposit(1,"1000000000000000000000")).to.be.revertedWith("not owner");

  })

  it("Mint Position",async function(){
    await stable.mint(user1.address,"2000000000000000000000");
    await oracle.setPrices([asset00.address,asset01.address,stable.address],["100000000000000000000",
    "50000000000000000000","1000000000000000000"]);
    await collateralConfig.setConfigs([stable.address,asset01.address],[["stableMock","100000",true],["asset01","100000",true]])
    await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","150000000000000000000",true]]);
    await assetConfig.setConfigs([asset01.address],[["mTESLA","20000000000000000000","150000000000000000000",true]]);
    let mintSynTest = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector.address]);
    await asset00.addSetter(mintSynTest.address);
    
    //open asset00 with stable
    await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",false);
    let pos = await mintSynTest.positions(1);
    expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    await asset01.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,asset01.address,"150000000000000000000",false);
    pos = await mintSynTest.positions(2);
    expect(await pos.mintAmount.toString()).to.equal("333333333333333333333");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(asset01.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    //deposit more token in positon 1
    await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).deposit(1,"1000000000000000000000");
    pos = await mintSynTest.positions(1);
    expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("2000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    //deposit more token in positon 2
    await asset01.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).deposit(2,"1000000000000000000000");
    pos = await mintSynTest.positions(2);
    expect(await pos.mintAmount.toString()).to.equal("333333333333333333333");
    expect(await pos.collateralAmount.toString()).to.equal("2000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(asset01.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    //error mint more than collateral token
    await expect(mintSynTest.connect(user1).mintAsset(1,"6666666666666666668")).to.be.revertedWith("Cannot mint asset over than min collateral ratio");
    
    await mintSynTest.connect(user1).mintAsset(1,"6666666666666666667");
    pos = await mintSynTest.positions(1);
    expect(await pos.mintAmount.toString()).to.equal("13333333333333333333");
    expect(await pos.collateralAmount.toString()).to.equal("2000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    await expect(mintSynTest.connect(user1).mintAsset(2,"333333333333333333334")).to.be.revertedWith("Cannot mint asset over than min collateral ratio");
    
    await mintSynTest.connect(user1).mintAsset(2,"333333333333333333333");
    pos = await mintSynTest.positions(2);
    expect(await pos.mintAmount.toString()).to.equal("666666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("2000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(asset01.address);
    expect(await pos.owner.toString()).to.equal(user1.address);
  })

  it("Burn Position",async function(){
    await stable.mint(user1.address,"2000000000000000000000");
    await oracle.setPrices([asset00.address,asset01.address,stable.address],["100000000000000000000",
    "50000000000000000000","1000000000000000000"]);
    await collateralConfig.setConfigs([stable.address,asset01.address],[["stableMock","100000",true],["asset01","100000",true]])
    await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","150000000000000000000",true]]);
    await assetConfig.setConfigs([asset01.address],[["mTESLA","20000000000000000000","150000000000000000000",true]]);
    let mintSynTest = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector.address]);
    await asset00.addSetter(mintSynTest.address);
    
    //open asset00 with stable
    await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",false);
    let pos = await mintSynTest.positions(1);
    expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    await asset01.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,asset01.address,"150000000000000000000",false);
    pos = await mintSynTest.positions(2);
    expect(await pos.mintAmount.toString()).to.equal("333333333333333333333");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(asset01.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

     //deposit more token in positon 1
     await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
     await mintSynTest.connect(user1).deposit(1,"1000000000000000000000");
     pos = await mintSynTest.positions(1);
     expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
     expect(await pos.collateralAmount.toString()).to.equal("2000000000000000000000");
     expect(await pos.asset.toString()).to.equal(asset00.address);
     expect(await pos.collateral.toString()).to.equal(stable.address);
     expect(await pos.owner.toString()).to.equal(user1.address);
 
     //deposit more token in positon 2
     await asset01.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
     await mintSynTest.connect(user1).deposit(2,"1000000000000000000000");
     pos = await mintSynTest.positions(2);
     expect(await pos.mintAmount.toString()).to.equal("333333333333333333333");
     expect(await pos.collateralAmount.toString()).to.equal("2000000000000000000000");
     expect(await pos.asset.toString()).to.equal(asset00.address);
     expect(await pos.collateral.toString()).to.equal(asset01.address);
     expect(await pos.owner.toString()).to.equal(user1.address);
    
    //mint more pos1
    await mintSynTest.connect(user1).mintAsset(1,"6666666666666666667");
    pos = await mintSynTest.positions(1);
    expect(await pos.mintAmount.toString()).to.equal("13333333333333333333");
    expect(await pos.collateralAmount.toString()).to.equal("2000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    await asset00.mint(user1.address,"1");
    await asset00.connect(user1).approve(mintSynTest.address, "2000000000000000000000");

    // failed to burn more than the position amount
    await expect(mintSynTest.connect(user1).burnAsset(1,"13333333333333333334")).to.be.revertedWith("Cannot burn asset more than you mint");
    await mintSynTest.connect(user1).burnAsset(1,"13333333333333333333");
    let balance = (await stable.balanceOf(collector.address)).toString()
    expect(balance).to.equal("13333333333333333333");

    //mint more pos 2
    await mintSynTest.connect(user1).mintAsset(2,"333333333333333333333");
    pos = await mintSynTest.positions(2);
    expect(await pos.mintAmount.toString()).to.equal("666666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("2000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(asset01.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    await expect(mintSynTest.connect(user1).burnAsset(2,"666666666666666666667")).to.be.revertedWith("Cannot burn asset more than you mint");
    await mintSynTest.connect(user1).burnAsset(2,"666666666666666666666");
    let balance2 = (await asset01.balanceOf(collector.address)).toString()
    expect(balance2).to.equal("13333333333333333333");
  })

  it("Withdraw Position",async function(){
    await oracle.setPrices([asset00.address,asset01.address,stable.address],["100000000000000000000",
    "50000000000000000000","1000000000000000000"]);
    await collateralConfig.setConfigs([stable.address,asset01.address],[["stableMock","100000",true],["asset01","100000",true]])
    await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","150000000000000000000",true]]);
    await assetConfig.setConfigs([asset01.address],[["mTESLA","20000000000000000000","150000000000000000000",true]]);
    let mintSynTest = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector.address]);
    await asset00.addSetter(mintSynTest.address);

    //open asset00 with stable
    await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",false);
    let pos = await mintSynTest.positions(1);
    expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    await asset01.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,asset01.address,"150000000000000000000",false);
    pos = await mintSynTest.positions(2);
    expect(await pos.mintAmount.toString()).to.equal("333333333333333333333");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(asset01.address);
    expect(await pos.owner.toString()).to.equal(user1.address);
    await expect(mintSynTest.connect(user1).withdraw(1,"1000000000000000000001")).to.be.revertedWith("Cannot withdraw more than you provide");
    await expect(mintSynTest.connect(user1).withdraw(1,"101")).to.be.revertedWith("Cannot withdraw collateral over than minimum collateral ratio");
    await mintSynTest.connect(user1).withdraw(1,"100");

    //open pos2
    await asset01.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,asset01.address,"150000000000000000000",false);
    pos = await mintSynTest.positions(2);
    expect(await pos.mintAmount.toString()).to.equal("333333333333333333333");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(asset01.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    await expect(mintSynTest.connect(user1).withdraw(1,"1000000000000000000001")).to.be.revertedWith("Cannot withdraw more than you provide");
    await expect(mintSynTest.connect(user1).withdraw(2,"2")).to.be.revertedWith("Cannot withdraw collateral over than minimum collateral ratio");
    await mintSynTest.connect(user1).withdraw(2,"1");
  });


  it("it should open postion and can liquidate ", async function(){
    await stable.mint(user1.address,"1000000000000000000000");
    await oracle.setPrices([asset00.address,asset01.address,stable.address],["100000000000000000000",
    "50000000000000000000","1000000000000000000"]);
    await collateralConfig.setConfigs([stable.address,asset01.address],[["stableMock","100000",true],["asset01","100000",true]])
    // min ratio 130%
    await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","130000000000000000000",true]]);
    // min ratio 150%
    await assetConfig.setConfigs([asset01.address],[["mTESLA","20000000000000000000","150000000000000000000",true]]);
    let mintSynTest = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector2.address]);
    await asset00.addSetter(mintSynTest.address);
    
    //open asset00 with stable
    await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",false);
    let pos = await mintSynTest.positions(1);        
    expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);
    
    //open pos2
    await asset01.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,asset01.address,"150000000000000000000",false);
    pos = await mintSynTest.positions(2);
    expect(await pos.mintAmount.toString()).to.equal("333333333333333333333");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(asset01.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    await oracle.setPrices([asset00.address,asset01.address],["115000000000000000000",
    "50000000000000000000"]);

    await asset00.connect(user2).approve(mintSynTest.address, "7000000000000000000");
    await expect(mintSynTest.connect(user2).auction(1,"1000000000000000000")).to.be.revertedWith("Cannot liquidate a safely collateralized position");

    await oracle.setPrices([asset00.address,asset01.address],["116000000000000000000",
    "50000000000000000000"]);
    let balance = (await stable.balanceOf(collector2.address)).toString()
    expect(balance).to.equal("0");

    await expect(mintSynTest.connect(user2).auction(1,"6666666666666666667")).to.be.revertedWith("Cannot liquidate more than the position amount");
    await expect(mintSynTest.connect(user2).auction(1,"6666666666666666666")).
     to.emit(asset00, 'Burn')
    .withArgs(mintSynTest.address,"6666666666666666666") // burn
    .and.to.emit(stable, "Transfer")
    .withArgs(mintSynTest.address, user1.address, "33333333333333333430") // return to user1
    .and.to.emit(stable, 'Transfer')
    .withArgs(mintSynTest.address,collector2.address,"7733333333333333332") // protocol fee 1%
    .and.to.emit(stable, 'Transfer')
    .withArgs(mintSynTest.address,user2.address,"958933333333333333238") // user2
    

    await oracle.setPrices([asset00.address,asset01.address],["200000000000000000000",
    "50000000000000000000"]);
    await asset00.connect(user2).approve(mintSynTest.address, "210000000000000000000");
    await asset00.mint(user2.address,"210000000000000000000");
    await expect(mintSynTest.connect(user2).auction(2,"210000000000000000000"))
    .to.emit(asset00,'Burn')
    .withArgs(mintSynTest.address,"200000000000000000000") // burn
    // .and.to.emit(stable, "Transfer")
    // .withArgs(mintSynTest.address, collector2.address, "8000000000000000000") // protocol fee 1%
    // .and.to.emit(stable, 'Transfer')
    // .withArgs(mintSynTest.address,user2.address,"992000000000000000000") // user2
  });

  it("liquidate with low discount test", async function(){
    await stable.mint(user1.address,"1000000000000000000000");
    await oracle.setPrices([asset00.address,stable.address],["1000000000000000000000","1000000000000000000"]);
    await collateralConfig.setConfigs([stable.address],[["stableMock","100000",true]])
    // min ratio 110%
    await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","110000000000000000000",true]]);
    let mintSynTest = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector2.address]);
    await asset00.addSetter(mintSynTest.address);

    await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"110000000000000000000",false);
    let pos = await mintSynTest.positions(1);        
    expect(await pos.mintAmount.toString()).to.equal("909090909090909090");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);
    await oracle.setPrices([asset00.address,stable.address],["1010000000000000000000","1000000000000000000"]);
    await asset00.connect(user2).approve(mintSynTest.address, "7000000000000000000");
    await expect(mintSynTest.connect(user2).auction(1,"909090909090909090"))
    .to.emit(asset00,'Burn')
    .withArgs(mintSynTest.address,"891089108910891090") // burn
    .and.to.emit(stable, "Transfer")
    .withArgs(mintSynTest.address, collector2.address, "9000000000000000009") // fee
    .and.to.emit(stable, "Transfer")
    .withArgs(mintSynTest.address, user2.address, "990999999999999999991") // user2
  })

  it("test get position", async function(){
    await stable.mint(user1.address,"1000000000000000000000");
    await oracle.setPrices([asset00.address,stable.address],["1000000000000000000000","1000000000000000000"]);
    await collateralConfig.setConfigs([stable.address],[["stableMock","100000",true]])
    // min ratio 110%
    await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","110000000000000000000",true]]);
    let mintSynTest = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector2.address]);
    await asset00.addSetter(mintSynTest.address);

    await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("10000000000000000000",asset00.address,stable.address,"110000000000000000000",false);
    await mintSynTest.connect(user1).openPosition("10000000000000000000",asset00.address,stable.address,"110000000000000000000",false);
    await mintSynTest.connect(user1).openPosition("10000000000000000000",asset00.address,stable.address,"110000000000000000000",false);
    await mintSynTest.connect(user1).openPosition("10000000000000000000",asset00.address,stable.address,"110000000000000000000",false);
    await mintSynTest.connect(user1).openPosition("10000000000000000000",asset00.address,stable.address,"110000000000000000000",false);
    await mintSynTest.connect(user1).openPosition("10000000000000000000",asset00.address,stable.address,"110000000000000000000",false);
    await mintSynTest.connect(user1).openPosition("10000000000000000000",asset00.address,stable.address,"110000000000000000000",false);
    let pos = await mintSynTest.positionBySize(user1.address,0,10);      
    console.log(pos); 
    await oracle.setPrices([asset00.address,stable.address],["1010000000000000000000","1000000000000000000"]);
    await asset00.connect(user2).approve(mintSynTest.address, "7000000000000000000");
    await mintSynTest.connect(user2).auction(1,"9090909090909090");
    pos = await mintSynTest.positionBySize(user1.address,0,10);      
    await mintSynTest.connect(user2).auction(3,"9090909090909090");
    pos = await mintSynTest.positionBySize(user1.address,0,10);      
  })

  it("Close Position",async function(){
    await stable.mint(user1.address,"2000000000000000000000");
    await oracle.setPrices([asset00.address,asset01.address,stable.address],["100000000000000000000",
    "50000000000000000000","1000000000000000000"]);
    await collateralConfig.setConfigs([stable.address,asset01.address],[["stableMock","100000",true],["asset01","100000",true]])
    await assetConfig.setConfigs([asset00.address],[["mAPPLE","20000000000000000000","150000000000000000000",true]]);
    await assetConfig.setConfigs([asset01.address],[["mTESLA","20000000000000000000","150000000000000000000",true]]);
    let mintSynTest = await upgrades.deployProxy(MintSynUpgrade, [oracle.address,assetConfig.address,collateralConfig.address,"100",collector.address]);
    await asset00.addSetter(mintSynTest.address);
    
    //open asset00 with stable
    await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",false);
    let pos = await mintSynTest.positions(1);
    expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

     //deposit more token in positon 1
     await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
     await mintSynTest.connect(user1).deposit(1,"1000000000000000000000");
     pos = await mintSynTest.positions(1);
     expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
     expect(await pos.collateralAmount.toString()).to.equal("2000000000000000000000");
     expect(await pos.asset.toString()).to.equal(asset00.address);
     expect(await pos.collateral.toString()).to.equal(stable.address);
     expect(await pos.owner.toString()).to.equal(user1.address);
 
    
    //mint more pos1
    await mintSynTest.connect(user1).mintAsset(1,"6666666666666666667");
    pos = await mintSynTest.positions(1);
    expect(await pos.mintAmount.toString()).to.equal("13333333333333333333");
    expect(await pos.collateralAmount.toString()).to.equal("2000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    await asset00.mint(user1.address,"1");
    await asset00.connect(user1).approve(mintSynTest.address, "2000000000000000000000");

    await expect(mintSynTest.connect(user1).burnAsset(1,"13333333333333333334")).to.be.revertedWith("Cannot burn asset more than you mint");
    await mintSynTest.connect(user1).closePosition(1);

    await stable.connect(user1).approve(mintSynTest.address, "1000000000000000000000");
    await mintSynTest.connect(user1).openPosition("1000000000000000000000",asset00.address,stable.address,"150000000000000000000",false);
    pos = await mintSynTest.positions(2);
    expect(await pos.mintAmount.toString()).to.equal("6666666666666666666");
    expect(await pos.collateralAmount.toString()).to.equal("1000000000000000000000");
    expect(await pos.asset.toString()).to.equal(asset00.address);
    expect(await pos.collateral.toString()).to.equal(stable.address);
    expect(await pos.owner.toString()).to.equal(user1.address);

    await mintSynTest.connect(user1).closePosition(2);
  })

});