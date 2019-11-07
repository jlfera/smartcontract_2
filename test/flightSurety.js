
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

const CONSENSUS_THRESHOLD = 4
const AIRLINE_REQUIRED_FUND_AMOUNT = web3.utils.toWei('10', 'ether')

contract('Flight Surety Tests', async (accounts) => {

  var config;
  let contractAddress
  let contractOwnerAddress
  let flightDataArray
  const airlineAddresses = []
  const passengerAddresses = []
 before('setup contract', async () => {
    config = await Test.Config(accounts);
    contractAddress = config.flightSuretyApp.address
    contractOwnerAddress = config.testAddresses[2]

    if (airlineAddresses.length === 0 && passengerAddresses.length === 0) {
      const [,, secondAirlineAddress, thridAirlineAddress, fourthAirlineAddress, fifthAirlineAddress, firstPassenger] = accounts
      // airline
      airlineAddresses.push(config.firstAirline)
      airlineAddresses.push(secondAirlineAddress)
      airlineAddresses.push(thridAirlineAddress)
      airlineAddresses.push(fourthAirlineAddress)
      airlineAddresses.push(fifthAirlineAddress)

      // passenger
      passengerAddresses.push(firstPassenger)
    }

    flightDataArray = [{
      flightCode: 'ND1309',
      timestamp: Math.floor(Date.now() / 1000),
      airlineAddress: airlineAddresses[1],
    }]


    //await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address, { from: config.flightSuretyData.address });
    await config.flightSuretyData.authorizeCaller(contractAddress);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) getRegisteredAirlineCount - first airline is registered`, async function () {

    // Get operating status
    let count = await config.flightSuretyData.getRegisteredAirlineCount.call();
    assert.equal(count, 1, "Incorrect count value of registered airline");

  });

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
    }
    catch(e) {

    }
    let result = await config.flightSuretyData.isAirline(newAirline, {from: contractAddress}); 

    // ASSERT
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

  });
 
  it('(airline) fund first airline so it can register another airline', async () => {
   
    let resultBefore = await config.flightSuretyData.isAirlineRegisteredAndFunded.call(airlineAddresses[0], {from: contractAddress});
    let isFirstAirlineRegistered = await config.flightSuretyData.isAirline(airlineAddresses[0], {from: contractAddress});
    await config.flightSuretyApp.airlineAddFunding({from: airlineAddresses[0], value: AIRLINE_REQUIRED_FUND_AMOUNT});
    let resultAfter = await config.flightSuretyData.isAirlineRegisteredAndFunded.call(airlineAddresses[0], {from: contractAddress});
    let airlineBalance = await config.flightSuretyData.getAirlineFundBalance.call({from: contractAddress});

    // ASSERT
    assert.equal(airlineBalance, AIRLINE_REQUIRED_FUND_AMOUNT, 'airlineBalance should equale to minFund as 1st airline paying fund')
    assert.equal(resultBefore, false, 'Airline is funded')
    assert.equal(isFirstAirlineRegistered, true, 'first airline did not register')
    assert.equal(resultAfter, true, 'Fail to pay fund for registered airline')


    // ARRANGE
    const newAirline = airlineAddresses[4];

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: airlineAddresses[0]});
      }
    catch(e) {

    }
    const result = await config.flightSuretyData.isAirline(newAirline, {from: contractAddress}); 
    let count = await config.flightSuretyData.getRegisteredAirlineCount();

    // ASSERT
    assert.equal(2, count);  // newAirline is registered
    assert.equal(result, true, "Airline should be able to register another airline as it has provided funding");

  });

  it('(airline) without Multiparty Consensus with registered airline less then CONSENSUS_THRESHOLD', async () => {
    let numberOfRegisteredAirline
    const registerNewAirline = async (index) => {
      const nextAirline = airlineAddresses[index]
      // ACT

      const assertAfterRegister = async () => {
        const nextRegisterResult = await config.flightSuretyData.isAirline(nextAirline, {from: contractAddress})
        if (numberOfRegisteredAirline < CONSENSUS_THRESHOLD) {
          assert.equal(nextRegisterResult, true, `Fail to register index:${index} airline`)
        } else {
          const isRegistering = await config.flightSuretyData.isAirlineRegistering(nextAirline, {from: contractAddress})
          assert.equal(nextRegisterResult, false, `Should fail to register index:${index} airline`)
          assert.equal(isRegistering, true, 'index > CONSENSUS_THRESHOLD should be registering')
        }
      }

      try {
        numberOfRegisteredAirline = BigNumber(await config.flightSuretyData.getRegisteredAirlineCount({from: contractAddress}))
        await config.flightSuretyApp.registerAirline(nextAirline, {from: airlineAddresses[0]})
        // ASSERT
        await assertAfterRegister()
      } catch (e) {
        // will fail when numberOfRegisteredAirline >= CONSENSUS_THRESHOLD
        // ASSERT
        numberOfRegisteredAirline = BigNumber(await config.flightSuretyData.getRegisteredAirlineCount.call({from: contractAddress}))
        await assertAfterRegister()
      }
    }

    // take accounts 2 - 5 for testing
    const registerTasks = []
    for (let index = 1; index < 5; index += 1) {
      registerTasks.push(registerNewAirline(index))
    }
    await Promise.all(registerTasks)
  });

  it('(airline) Multiparty Consensus works on registering new airline', async () => {
    // ARRANGE
    const nextNewAirlineAddress = accounts[4]
    // ACT
    const beforeIsNotRegistered = await config.flightSuretyData.isAirline.call(nextNewAirlineAddress, {from: contractAddress})
    const beforeIsRegistering = await config.flightSuretyData.isAirlineRegistering.call(nextNewAirlineAddress, {from: contractAddress})
    // ASSERT
    assert.equal(beforeIsNotRegistered, false, '5th airline is already registered')
    assert.equal(beforeIsRegistering, true, '5th airline is not registering')

    // ACT
    await config.flightSuretyApp.registerAirline(nextNewAirlineAddress, {from: airlineAddresses[0]})
    const afterRegisterResult = await config.flightSuretyData.isAirline.call(nextNewAirlineAddress, {from: contractAddress})
    const afterIsRegistering = await config.flightSuretyData.isAirlineRegistering.call(nextNewAirlineAddress, {from: contractAddress})
    // ASSERT
    assert.equal(afterRegisterResult, true, 'Fail to register 5th airline')
    assert.equal(afterIsRegistering, false, '5th airline should be registering done')
  })

  it('(airline) all airline pay fund - total 5 registed airline', async () => {
    const addFunding = async (index) => {
      const nextAirline = accounts[index]
      // ACT
      const registerResult = await config.flightSuretyData.isAirline(nextAirline, {from: contractAddress})
      const payFundResult = await config.flightSuretyData.isAirlineRegisteredAndFunded.call(nextAirline, {from: contractAddress})

      if (registerResult && !payFundResult) {
        await config.flightSuretyApp.airlineAddFunding({from: nextAirline, value: AIRLINE_REQUIRED_FUND_AMOUNT})
        const afterPayFundResult = await config.flightSuretyData.isAirlineRegisteredAndFunded.call(nextAirline, {from: contractAddress})
        // ASSERT
        assert.equal(afterPayFundResult, true, 'Fail to pay fund for registered airline')
      }
    }

    const addFundTasks = []
    for (let index = 1; index < airlineAddresses.length; index += 1) {
      addFundTasks.push(addFunding(index))
    }
    await Promise.all(addFundTasks)
    // ASSERT
    const airlineBalance = await config.flightSuretyData.getAirlineFundBalance.call({from: contractAddress})
    assert.equal(airlineBalance, AIRLINE_REQUIRED_FUND_AMOUNT * 4, 'There should be 5 airline registed, with 5 * AIRLINE_REQUIRED_FUND_AMOUNT')
    assert.equal(web3.utils.fromWei(airlineBalance, 'ether'), 40, 'There should be 5 airline registed, with 5 * AIRLINE_REQUIRED_FUND_AMOUNT')
  })

  it('(flight) register a flight', async () => {
    // ARRANGE
    const {airlineAddress, flightCode, timestamp} = flightDataArray[0]
    // ACT
    const flightKey = await config.flightSuretyData.getFlightKey(airlineAddress, flightCode, timestamp, {from: contractAddress})
    const beforeFlightRegistered = await config.flightSuretyData.checkIsFlightRegistered(flightKey, {from: contractAddress})
    await config.flightSuretyApp.registerFlight(flightCode, timestamp, {from: airlineAddress})
    const isFlightRegistered = await config.flightSuretyData.checkIsFlightRegistered(flightKey, {from: contractAddress})
    // ASSERT
    assert.equal(beforeFlightRegistered, false, 'Flight is registered before')
    assert.equal(isFlightRegistered, true, 'Cannot register flight')
  })

  it('(insurance) buy Insurance', async () => {
    // ARRANGE
    const {airlineAddress, flightCode, timestamp} = flightDataArray[0]
    const passengerAddress = passengerAddresses[0]
    const amountToPaid = web3.utils.toWei('1', 'ether')
    // ACT
    const insuranceBalanceBeforeBuyInsurance = await config.flightSuretyData.getInsuranceBalance.call({from: contractAddress})
    await config.flightSuretyApp.buyInsurance(passengerAddress, airlineAddress, flightCode, timestamp, amountToPaid, {from: passengerAddress, value: amountToPaid})
    const isPassengerRegistered = await config.flightSuretyData.checkIsPassengerRegistered(passengerAddress, {from: contractAddress})
    const insuranceAmmount = await config.flightSuretyApp.getPassengerInsuranceAmount.call(airlineAddress, flightCode, timestamp, {from: passengerAddress})
    const insuranceBalanceAfterBuyInsurance = await config.flightSuretyData.getInsuranceBalance.call({from: contractAddress})

    // ASSERT
    assert.equal(isPassengerRegistered, true, 'Didn\'t register passenger')
    assert.equal(web3.utils.fromWei(insuranceBalanceBeforeBuyInsurance, 'ether'), 0, 'Passanger insurance amount is less then 0')
    assert.equal(insuranceAmmount, amountToPaid, 'Passanger insurance amount is less then 0')
    assert.equal(insuranceBalanceAfterBuyInsurance, amountToPaid, 'Passanger insurance amount is less then 0')
  })


  it('(insurance) add insurance balance', async () => {
    // ARRANGE
    // ACT
    // airlineAddresses
    const insuranceBalanceBeforeAddInsurance = await config.flightSuretyData.getInsuranceBalance({from: contractAddress})
    await config.flightSuretyApp.addInsuranceBalance(web3.utils.toWei('1', 'ether'), {from: airlineAddresses[0], value: web3.utils.toWei('2', 'ether')})
    const insuranceBalanceAfterAddInsurance = await config.flightSuretyData.getInsuranceBalance.call({from: contractAddress})
    // ASSERT
    assert.notEqual(insuranceBalanceBeforeAddInsurance, insuranceBalanceAfterAddInsurance, 'Cannot add insurance balance')
    assert.equal(web3.utils.fromWei(insuranceBalanceAfterAddInsurance, 'ether'), 2, 'Cannot add insurance balance')
  })
  
  it('(flight) update flight status to delay', async () => {
    // ARRANGE
    const flightDelayStatusCode = 20
    const {airlineAddress, flightCode, timestamp} = flightDataArray[0]

    // ACT
    const flightStatusBeforeUpdate = await config.flightSuretyData.getFlightStatus(airlineAddress, flightCode, timestamp, {from: contractAddress})
    await config.flightSuretyApp.updateFlightStatus(flightCode, timestamp, flightDelayStatusCode, {from: airlineAddress})
    const updatedFlightStatus = await config.flightSuretyData.getFlightStatus(airlineAddress, flightCode, timestamp, {from: contractAddress})
    // ASSERT
    assert.equal(flightStatusBeforeUpdate, 0, 'Status should be 0')
    assert.notEqual(flightStatusBeforeUpdate, flightDelayStatusCode, 'Status should equal to flightDelayStatusCode')
    assert.equal(updatedFlightStatus, flightDelayStatusCode, 'Status should be flightDelayStatusCode')
  })
  
  it('(insurance) passenger receives credit of insurance payout', async () => {
    // ARRANGE
    const flightDelayStatusCode = 20
    const {airlineAddress, flightCode, timestamp} = flightDataArray[0]
    const passengerAddress = passengerAddresses[0]

    // ACT
    const flightStatus = await config.flightSuretyData.getFlightStatus(airlineAddress, flightCode, timestamp, {from: contractAddress})
    const insuranceAmmount = await config.flightSuretyApp.getPassengerInsuranceAmount(airlineAddress, flightCode, timestamp, {from: passengerAddress})
    const passangerBalanceBefore = await config.flightSuretyData.getPassengerBalance(passengerAddress, {from: contractAddress})
    await config.flightSuretyApp.insurancePayout(airlineAddress, flightCode, timestamp, {from: passengerAddress})
    const passangerBalanceAfter = await config.flightSuretyData.getPassengerBalance(passengerAddress, {from: contractAddress})

    // ASSERT
    assert.equal(flightStatus, flightDelayStatusCode, 'Status should be flightDelayStatusCode')
    assert.equal(passangerBalanceBefore, 0, 'Passanger should be 0 at the beginning')
    assert.equal(passangerBalanceAfter, insuranceAmmount * 1.5, 'Status should be flightDelayStatusCode')
  })

  it('(insurance) passenger withdraw funds', async () => {
    // ARRANGE
    const passengerAddress = passengerAddresses[0]
    const currentBalance = await web3.eth.getBalance(passengerAddress)
    const withdrawAmount = web3.utils.toWei('1', 'ether')
    // ACT
    await config.flightSuretyApp.withdrawPassengerBalance(withdrawAmount, {from: passengerAddress})
    const afterBalance = await web3.eth.getBalance(passengerAddress)
    // ASSERT
    assert.equal(afterBalance >= currentBalance, true, 'Withdraw fail')
  })

});