pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping(address => uint256) private authorizedContracts;

    struct Airline {
        bool isRegistered;
        bool isFunded;
        mapping(address => bool) votedForAirlines;
    }

    struct Flight {
        bool isFlight;
        string flightCode;
        uint256 timestamp;
        uint8 statusCode;
        address airline;
     }

    struct Insurance {
        bytes32 flightKey;
        uint256 premiumAmount;
        bool isRefunded;
    }

    struct Passenger {
        bool isPassenger;
        uint256 accountBalance;
        // mapping for storing passenger-insurance key to insurances
        mapping(bytes32 => Insurance) flightInsurances;
    }


    uint256 private numberOfRegisteredAirlines = 0;
    mapping(address => Airline) private airlines;
    mapping(address => uint256) private registeringAirlines;

    mapping(bytes32 => Flight) private flights;
    mapping(address => Passenger) private passengers;

    mapping(address => uint256) airlineBalances;
    uint256 private airlineBalance = 0;
    uint256 private insuranceBalance = 0;


    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    event AirlineRegistered(address airline);
    event AirlineFunded(address airline, uint256 value);
    event FlightRegistered(address airline, string flight, uint256 timestamp);

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                    address deployingAccount
                                )
                                public
    {
        contractOwner = msg.sender;

         // register first airline when contract is deployed
        _registerAirline(deployingAccount);
   }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational()
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireIsAuthorizedContract()
    {
        require(authorizedContracts[msg.sender] == 1, "Caller is not authorized App contract owner");
        _;
    }

    modifier requireAirlineRegistered(address airlineAddress){
        require(_isAirlineRegistered(airlineAddress), "Caller is not airline");
        _;
    }

    modifier requireAirlineRegisteredAndFunded(address airlineAddress){
        require(_isAirlineRegistered(airlineAddress) && _isAirlineFunded(airlineAddress), "Caller is not airline");
        _;
    }

     modifier isPassenger(address passenger){
        require(_isPassengerRegistered(passenger), "Callis is not passenger");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational()
                            public
                            view
                            returns(bool)
    {
        return operational;
    }

  function isAuthorized()
                            public
                            view
                            returns(bool)
  {
        if (authorizedContracts[msg.sender] == 1) return true;
        return false;
  }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus
                            (
                                bool mode
                            )
                            external
                            requireContractOwner
    {
        operational = mode;
    }

    /**
    * @dev Authorize data contract callers
    */
    function authorizeCaller(address caller) external requireContractOwner {
        authorizedContracts[caller] = 1;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline
                            (
                                address newAirlineAddress,
                                address callerAirline
                            )
                            external
                            requireIsOperational
                            requireIsAuthorizedContract
                            requireAirlineRegisteredAndFunded(callerAirline)
    {
        _registerAirline(newAirlineAddress);
    }

    function voteForNewAirline
                              (
                                address airlineAddressToVote,
                                address callerAirline
                              )
                              external
                              requireIsOperational
                              requireIsAuthorizedContract
                              requireAirlineRegistered(callerAirline)
                              returns(uint256 votes)
    {
        airlines[callerAirline].votedForAirlines[airlineAddressToVote] = true;
        registeringAirlines[airlineAddressToVote] = registeringAirlines[airlineAddressToVote].add(1);

        votes = registeringAirlines[airlineAddressToVote];
    }

    function getRegisteredAirlineCount() external view returns(uint256 count) {
        count = numberOfRegisteredAirlines;
    }

    function airlineAddFunding(address airline)
                            external payable
                            requireIsOperational
                            requireIsAuthorizedContract
                            requireAirlineRegistered(airline)
     {
        require(msg.value > 0, "The funding amount should be > 0");
        require(!airlines[airline].isFunded, "Calling airline has already funded their account");
        airlineBalance = airlineBalance.add(msg.value);
        airlines[airline].isFunded = true;
        emit AirlineFunded(airline, msg.value);
    }

    function isAirline(address airlineAddress)
                        external
                        view
                        requireIsOperational
                        requireIsAuthorizedContract
                        returns(bool)
    {
        return _isAirlineRegistered(airlineAddress);
    }

    function isAirlineRegistering(address airlineAddress)
                        external
                        view
                        requireIsOperational
                        requireIsAuthorizedContract
                        returns(bool)
    {
        return _isAirlineRegistering(airlineAddress);
    }

    function isAirlineRegisteredAndFunded(address airlineAddress)
                        external
                        requireIsOperational
                        requireIsAuthorizedContract
                        returns(bool)
    {
        return _isAirlineRegistered(airlineAddress) && _isAirlineFunded(airlineAddress);
    }

    function getAirlineFundBalance()
                        external
                        view
                        requireIsOperational
                        requireIsAuthorizedContract
                        returns(uint256)
    {
        return airlineBalance;
    }

    function registerFlight
                            (
                                string flightCode,
                                uint256 timestamp,
                                address callerAirline
                            )
                            external
                            requireIsOperational
                            requireIsAuthorizedContract
                            requireAirlineRegistered(callerAirline)
    {
        bytes32 flightKey = _getFlightKey(callerAirline, flightCode, timestamp);
        flights[flightKey] = Flight({
            isFlight: true,
            flightCode: flightCode,
            timestamp: timestamp,
            statusCode: 0,
            airline: msg.sender
        });
        emit FlightRegistered(callerAirline, flightCode, timestamp);
    }

    function checkIsFlightRegistered(bytes32 flightKey)
                external
                view
                requireIsOperational
                requireIsAuthorizedContract
                returns(bool)
    {
        return _isFlightRegistered(flightKey);
    }

    function setFlightStatus(
                            string flightCode,
                            uint256 timestamp,
                            uint8 statusCode,
                            address callerAirline
                            )
                            external
                            requireIsOperational
                            requireIsAuthorizedContract
                            requireAirlineRegistered(callerAirline)
    {
        bytes32 flightKey = _getFlightKey(callerAirline, flightCode, timestamp);
        require(_isFlightRegistered(flightKey), "Flight not registered");
        flights[flightKey].statusCode = statusCode;
    }

    function getFlightStatus(
                            address airlineAddress,
                            string flightCode,
                            uint256 timestamp
                            )
                            external view
                            requireIsOperational
                            requireIsAuthorizedContract
                            returns(uint8)
    {
        bytes32 flightKey = _getFlightKey(airlineAddress, flightCode, timestamp);
        require(_isFlightRegistered(flightKey), "Flight not registered");
        return flights[flightKey].statusCode;
    }

    event PassengerCreditBalance(address passenger, uint256 credit);
    function getPassengerBalance(address passengerAddress)
                                external view requireIsOperational
                                requireIsAuthorizedContract
                                isPassenger(passengerAddress)
                                returns(uint256)
    {
        return passengers[passengerAddress].accountBalance;
    }

    event PassengerWithdrawn(address passenger, uint256 amount);
    // Passenger withdraws insurance payout
    function withdrawPassengerBalance(
                                        uint256 withdrawAmount,
                                        address callerPassenger
                                     )
                                    external payable
                                    requireIsOperational
                                    requireIsAuthorizedContract
                                    isPassenger(callerPassenger)
    {
        require(passengers[callerPassenger].accountBalance >= withdrawAmount, "Withdraw is larger than passenger insurance credit balance");
        passengers[callerPassenger].accountBalance = passengers[callerPassenger].accountBalance.sub(withdrawAmount);
        callerPassenger.transfer(withdrawAmount);
        emit PassengerWithdrawn(callerPassenger, withdrawAmount);
    }

    function getInsuranceBalance() external view requireIsOperational requireIsAuthorizedContract returns(uint256) {
        return insuranceBalance;
    }

    function addInsuranceBalance(address callerAddress) external payable
    requireIsOperational requireIsAuthorizedContract requireAirlineRegistered(callerAddress)
    {
        insuranceBalance = insuranceBalance.add(msg.value);
    }

   /**
    * @dev Buy insurance for a flight
    *
    */
    function buyInsurance
                            (
                                address passenger,
                                bytes32 flightKey,
                                uint256 premiumAmount
                            )
                            external
                            payable
                            requireIsOperational
                            requireIsAuthorizedContract
     {
        bytes32 insuranceKey = _getInsuranceKey(passenger, flightKey);
        require(passengers[passenger].flightInsurances[insuranceKey].flightKey != flightKey, "Passenger has paid for insurance");
        passengers[passenger].isPassenger = true;
        passengers[passenger].accountBalance = 0;
        insuranceBalance = insuranceBalance.add(msg.value);
        passengers[passenger].flightInsurances[insuranceKey] = Insurance({
            flightKey: flightKey,
            premiumAmount: premiumAmount,
            isRefunded: false
        });
    }

    function checkIsPassengerRegistered(address passenger)
                external
                view
                requireIsOperational
                requireIsAuthorizedContract
                returns(bool)
    {
        return _isPassengerRegistered(passenger);
    }

    /**
    * @dev Get passenger insurance amount
    *
    */
   function getPassengerInsuranceAmount(bytes32 flightKey,
                                        address callerPassenger)
                                        external
                                        view
                                        requireIsOperational
                                        requireIsAuthorizedContract
                                        isPassenger(callerPassenger)
                                        returns(uint256)
    {
        bytes32 insuranceKey = _getInsuranceKey(callerPassenger, flightKey);
        return passengers[callerPassenger].flightInsurances[insuranceKey].premiumAmount;
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                            (
                            )
                            external
                            requireIsOperational
                            requireIsAuthorizedContract
    {
    }

    function insurancePayout
                            (
                                bytes32 flightKey,
                                uint256 payoutRate,
                                address callerPassenger
                            )
                            external
                            requireIsOperational
                            requireIsAuthorizedContract
    {
        require(passengers[callerPassenger].isPassenger, "Invalid passenger address");
        bytes32 insuranceKey = _getInsuranceKey(callerPassenger, flightKey);
        require(passengers[callerPassenger].flightInsurances[insuranceKey].flightKey == flightKey, "Passenger did not buy insurance");
        uint256 payout = passengers[callerPassenger].flightInsurances[insuranceKey].premiumAmount.mul(payoutRate).div(100);
        require(airlineBalance >= payout, "Not enough airlines insurance balance");
        airlineBalance = airlineBalance.sub(payout);
        passengers[callerPassenger].accountBalance = passengers[callerPassenger].accountBalance.add(payout);
        passengers[callerPassenger].flightInsurances[insuranceKey].isRefunded = true;
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                            )
                            external
                            pure
    {
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund
                            (
                            )
                            public
                            payable
    {
    }

    function getFlightKey
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        external
                        view
                        requireIsOperational
                        requireIsAuthorizedContract
                        returns(bytes32)
    {
        return _getFlightKey(airline, flight, timestamp);
    }

    function getInsuranceKey
                            (
                                address passenger,
                                bytes32 flightKey
                            )
                            internal
                            pure
                            returns(bytes32) {
        return _getInsuranceKey(passenger, flightKey);
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function()
                            external
                            payable
    {
        fund();
    }

    /********************************************************************************************/
    /*                                        INTERNAL FUNCTIONS                                */
    /********************************************************************************************/
    function _registerAirline(address newAirlineAddress) private requireIsOperational
    {
        // accept the new register
        airlines[newAirlineAddress].isRegistered = true;
        numberOfRegisteredAirlines = numberOfRegisteredAirlines.add(1);
        _voteDone(newAirlineAddress);
        emit AirlineRegistered(newAirlineAddress);
    }

    function _voteDone(address airlineAddressToVote) private requireIsOperational {
        registeringAirlines[airlineAddressToVote] = 0;
    }

    function _isAirlineRegistered(address airlineAddress) private view returns(bool) {
        return (airlines[airlineAddress].isRegistered);
    }

    function _isAirlineRegistering(address airlineAddress) private view returns(bool) {
        return (registeringAirlines[airlineAddress] > 0);
    }

    function _isAirlineFunded(address airlineAddress) private view returns(bool) {
        return (airlines[airlineAddress].isFunded);
    }

    function _isFlightRegistered(bytes32 flightKey) private view requireIsOperational returns(bool){
        return flights[flightKey].isFlight;
    }

     function _isPassengerRegistered(address passenger) private view requireIsOperational returns(bool){
        return passengers[passenger].isPassenger;
    }

    function _getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        internal
                        pure
                        returns(bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function _getInsuranceKey
                            (
                                address passenger,
                                bytes32 flightKey
                            )
                            internal
                            pure
                            returns(bytes32) {
        return keccak256(abi.encodePacked(passenger, flightKey));
    }

}
