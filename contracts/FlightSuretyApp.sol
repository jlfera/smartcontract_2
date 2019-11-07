pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./FlightSuretyData.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract
    FlightSuretyData private flightSuretyData;
    bool private operational = true;

    uint8 private constant AIRLINES_CONSENSUS_THRESHOLD = 4;
    uint8 private constant AIRLINES_MULTI_PART_CONSENSUS_RATE = 2;
    uint private constant AIRLINE_CONTRACT_FEE = 10 ether;
    uint private constant MAX_INSURANCE_PREMIUM_AMOUNT = 1 ether;
    uint private constant PAYOUT_RATE = 150;

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

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor
                                (
                                    address dataAddress
                                )
                                public
    {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(dataAddress);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational()
                            public
                            view
                            returns(bool)
    {
        return operational;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

  
   /**
    * @dev Add an airline to the registration queue
    *
    */
    function registerAirline
                            (
                                address newAirline
                            )
                            external
                            requireIsOperational
                            returns(bool success, uint256 votes)
    {
        uint256 registeredAirlineCount = flightSuretyData.getRegisteredAirlineCount();
        success = false;
        if (registeredAirlineCount >= AIRLINES_CONSENSUS_THRESHOLD) {
            votes = flightSuretyData.voteForNewAirline(newAirline, msg.sender);
            if (votes >= (registeredAirlineCount / AIRLINES_MULTI_PART_CONSENSUS_RATE)) {
                flightSuretyData.registerAirline(newAirline, msg.sender);
                success = true;
            }
        } else {
            votes = 0;
            flightSuretyData.registerAirline(newAirline, msg.sender);
            success = true;
        }
        return (success, votes);
    }

    function airlineAddFunding()
                    external
                    payable
                    requireIsOperational {
        require(msg.value >= AIRLINE_CONTRACT_FEE, "Not enough ether to pay");
        uint256 amountToReturn = msg.value - AIRLINE_CONTRACT_FEE;
        flightSuretyData.airlineAddFunding.value(AIRLINE_CONTRACT_FEE)(msg.sender);
        msg.sender.transfer(amountToReturn);
    }

   /**
    * @dev Register a future flight for insuring.
    *
    */
    function registerFlight
                                (
                                    string flightCode,
                                    uint256 timestamp
                                )
                                external
    {
        require(flightSuretyData.checkIsFlightRegistered(getFlightKey(msg.sender, flightCode, timestamp)) == false, "Flight already registered");
        flightSuretyData.registerFlight(flightCode, timestamp, msg.sender);
    }

   /**
    * @dev Called after oracle has updated flight status
    *
    */
    function processFlightStatus
                                (
                                    address airline,
                                    string memory flight,
                                    uint256 timestamp,
                                    uint8 statusCode
                                )
                                internal
                                pure
    {
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    }

    function updateFlightStatus(string flightCode, uint256 timestamp, uint8 statusCode) external {
        bytes32 flightKey = getFlightKey(msg.sender, flightCode, timestamp);
        require(flightSuretyData.checkIsFlightRegistered(flightKey), "Flight code is not valid");
        flightSuretyData.setFlightStatus(
            flightCode,
            timestamp,
            statusCode,
            msg.sender
        );
    }

    function addInsuranceBalance(uint256 addValue) external payable {
        uint256 amountToReturn = msg.value - addValue;
        flightSuretyData.addInsuranceBalance.value(addValue)(msg.sender);
        msg.sender.transfer(amountToReturn);
    }

    event InsurancePurchased(address airline, string flight, uint256 timestamp, address passenger, uint256 amount);
   /**
    * @dev Passenger buy insurance
    *
    */
    function buyInsurance
                        (
                            address passenger,
                            address airline,
                            string flightCode,
                            uint256 timestamp,
                            uint256 amountToPaid
                        )
                        external payable
    {
        require(flightSuretyData.isAirline(airline), "Airline address is not registered");
        bytes32 flightKey = getFlightKey(airline, flightCode,  timestamp);
        require(flightSuretyData.checkIsFlightRegistered(flightKey), "Flight is not registered");
        require(amountToPaid > 0, "Insurance amount should be > 0");
        require(amountToPaid <= MAX_INSURANCE_PREMIUM_AMOUNT, "Insurance amount is over the maximum premium limit");
        require(msg.value >= amountToPaid, "Passenger has not enough ether to pay");
        flightSuretyData.buyInsurance.value(amountToPaid)(passenger, flightKey, amountToPaid);
        emit InsurancePurchased(airline, flightCode, timestamp, passenger, msg.value);
    }

   /**
    * @dev Get passenger Insurance record
    *
    */
    function getPassengerInsuranceAmount(address airline,  string flightCode, uint256 timestamp) external view returns(uint256){
        bytes32 flightKey = getFlightKey(airline, flightCode,  timestamp);
        return flightSuretyData.getPassengerInsuranceAmount(flightKey, msg.sender);
    }


   event InsurancePaidout(address airline, string flight, uint256 timestamp, address passenger);
    function insurancePayout(
                            address airline,
                            string flightCode,
                            uint256 timestamp)
                            external
    {
        require(flightSuretyData.isAirlineRegisteredAndFunded(airline), "Airline is not participated in contract");
        bytes32 flightKey = getFlightKey(airline, flightCode,  timestamp);
        // check flight state
        uint8 flightStatus = flightSuretyData.getFlightStatus(airline, flightCode, timestamp);
        require(flightStatus == STATUS_CODE_LATE_AIRLINE, "Flight Status is not for payout");
        // payout
        flightSuretyData.insurancePayout(flightKey, PAYOUT_RATE, msg.sender);
        emit InsurancePaidout(airline, flightCode, timestamp, msg.sender);
    }

    function getPassengerBalance(address passenger) external returns(uint256)
    {
        return flightSuretyData.getPassengerBalance(passenger);
    }

    function withdrawPassengerBalance(uint256 withdrawAmount)
                                    external payable
    {
        flightSuretyData.withdrawPassengerBalance(withdrawAmount, msg.sender);
    }

// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    uint256 private oraclesCount;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);

    function getOraclesCount ( ) external view returns(uint256)
    {
        return oraclesCount;
    }

    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            external
                            payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
        oraclesCount++;
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            returns(uint8[3])
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

     function getInsuranceKey
                        (
                            address passenger,
                            bytes32 flightKey
                        )
                        external
                        view
                        requireIsOperational

                        returns(bytes32)
    {
        return keccak256(abi.encodePacked(passenger, flightKey));
    }

   // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (
                                address account
                            )
                            internal
                            returns(uint8[3])
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}