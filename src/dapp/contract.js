import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import AddressInfo from "../server/addressInfo";


export default class Contract {
   constructor(network, callback) {

        let config = Config[network];
        this.config = config;
        this.web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace("http", "ws")));
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.getAllEvents();
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.flights = [];
        this.passengers = [];
    }

    async initialize(callback) {
        try {
            const accts = await this.web3.eth.getAccounts();
            if (!accts || accts.length === 0) {
                return callback("Error! Access To Etherum Blockchain Failed.");
            }

            this.owner = accts[0];
            this.airlinesInfo = AddressInfo.getAirlines(accts);
            this.airlines = this.airlinesInfo.map(airline => airline.address);
            this.passengersInfo = AddressInfo.getPassengers(accts);
            this.passengers = this.passengersInfo.map(passenger => passenger.address);
            this.flightsInfo = AddressInfo.getFlights(accts);
            
            const isAuth = await this.flightSuretyData.methods.isAuthorized().call({ from: this.config.appAddress });
            if (!isAuth) {
                await this.flightSuretyData.methods.authorizeCaller(this.config.appAddress).send({ from: this.owner });
            }
            return callback(null);
        } catch (e) {
            const msg = `Error! Blockchain up? Contract deployed? ${e}`;
            console.log(msg);
            callback(msg);
        }
    }

    getAllEvents() {
        try {
          this.flightSuretyApp.events.allEvents(
            { fromBlock: "latest" },
            (err, res) =>
                console.log(
                    `event-A >>`,
                    err,
                    res && res.event ? res.event : "",
                    res && res.returnValues ? res.returnValues : ""
                )
            );
            this.flightSuretyData.events.allEvents(
                { fromBlock: "latest" },
                (err, res) =>
                    console.log(
                        `event-D >>`,
                        err,
                        res && res.event ? res.event : "",
                        res && res.returnValues ? res.returnValues : ""
                    )
            );
        } catch (e) {
            console.error("Failed getting events due to:", e);
        }
    }

    isOperational(callback) {
        let self = this;
        self.flightSuretyApp.methods
             .isOperational()
             .call({ from: self.owner}, callback);
     }
 
    async registerAirline(airline, requestedBy){
        let self = this;
        return await self.flightSuretyApp.methods.registerAirline(airline)
                .send({ from: requestedBy, gas: 2000000 });
    }


    getRegisterAirlineEvent(msgcb) {
        this.flightSuretyData.events.AirlineRegistered(
          { fromBlock: "latest" },
          (err, res) => {
            if (err) return msgcb("Registering Airline Failed");
            const { airline } = res.returnValues;
            const a = this.getAirlineNameFromAddress(airline);
            msgcb(`Airline ${a} is registered.`);
          }
        );
    }

    async sendFundToAirline(airline,funds){
        let self = this;
        let amount = self.web3.utils.toWei(funds, "ether").toString();
        return await self.flightSuretyApp.methods.airlineAddFunding().send({ from: airline, value:amount});
    }

    getAirlineNameFromAddress(address) {
        const { name } = this.airlinesInfo.filter(a => a.address === address)[0];
        return name;
    }
    
    getFundAirlineEvent(msgcb) {
        this.flightSuretyData.events.AirlineFunded({ fromBlock: "latest" }, (err, res) => {
            if (err) return msgcb("Funding Failed");
            const { airline, value } = res.returnValues;
            const name = this.getAirlineNameFromAddress(airline);
            msgcb(`Funded ${name} with ${this.web3.utils.fromWei(value)} ether.`);
        });
    }
 
    async registerFlight(airline, flight, timestamp) {
        return await this.flightSuretyApp.methods
          .registerFlight(flight, timestamp)
          .send({ from: airline, gas: 2000000 });
    }
    
    getRegisterFlightEvent(msgcb) {
        this.flightSuretyData.events.FlightRegistered(
            { fromBlock: "latest" },
            (err, res) => {
                if (err) return msgcb("Registering Flight Failed");
                const { airline, flight, timestamp } = res.returnValues;
                const name = this.getAirlineNameFromAddress(airline);
                msgcb(`Registered Flight ${flight} @ ${timestamp} on ${name}`);
            }
        );
    }
        
    async buyInsurance(passenger, airline, flight, timestamp, insuranceAmount){
        let self = this;
        let amount = self.web3.utils.toWei(insuranceAmount);
         return await self.flightSuretyApp.methods.buyInsurance(passenger, airline, flight, timestamp, amount)
                .send({ from: passenger, value: amount,  gas:3000000 });
    }

    getPassenger = pa =>
        this.passengersInfo.filter(p => p.address === pa)[0].name;

    getBuyInsuranceEvent(msgcb) {
        this.flightSuretyApp.events.InsurancePurchased({ fromBlock: "latest" }, (err, res) => {
            if (err) return msgcb("Buying Insurance Failed");
            const {
                    airline,
                    flight,
                    timestamp,
                    passenger,
                    amount
            } = res.returnValues;
            const al = this.getAirlineNameFromAddress(airline);
            const p = this.getPassenger(passenger);
            let msg = `Bought ${this.web3.utils.fromWei(amount)} ether worth of`;
            msg += ` insurance for ${p} on ${flight} @ ${timestamp} on ${al}.`;
            msgcb(msg);
        });
    }

    getFlightStatusStr(no) {
        switch (no) {
            case "0":
            return "Unknown";
        case "10":
            return "On Time";
        case "20":
            return "Late Airline";
        case "30":
            return "Late Weather";
        case "40":
            return "Late Technical";
        case "50":
            return "Late Other";
        default:
            return "Really Unknown";
        }
    }

    async fetchFlightStatus(airline, flight, timestamp) {
        await this.flightSuretyApp.methods
            .fetchFlightStatus(airline, flight, timestamp)
            .send({ from: this.owner });
    }
    
    getFlightStatusInfoEvent(msgcb) {
        this.flightSuretyApp.events.FlightStatusInfo(
            { fromBlock: "latest" },
            (err, res) => {
                if (err) return msgcb("Failed getting flight status");
                const { airline, flight, timestamp, status } = res.returnValues;
                const al = this.getAirlineNameFromAddress(airline);
                const ss = this.getFlightStatusStr(status);
                msgcb(`${flight} @ ${timestamp} on ${al} status was: ${ss}`);
            }
        );
    }

    async claimInsurance(address, airline, flight, timestamp) {
        // to demo that passenger is able to claim for insurance refund
        // first set airline flght status to be "20" - Late Airline 
         await this.flightSuretyApp.methods
            .updateFlightStatus(flight, timestamp, "20")
            .send( {from: airline} );
        return await this.flightSuretyApp.methods
            .insurancePayout(airline, flight, timestamp)
            .send({ from: address });
    }
    
    getClaimInsuranceEvent(msgcb) {
        this.flightSuretyApp.events.InsurancePaidout({ fromBlock: "latest" }, (err, res) => {
            if (err) return msgcb(`Failed getting payout. ${err}`);
                const { airline, flight, timestamp, passenger } = res.returnValues;
                const al = this.getAirlineNameFromAddress(airline);
                const p = this.getPassenger(passenger);
                msgcb(`Insurance was payed out for ${p} on ${flight} @ ${timestamp} on ${al}.`);
            });
    }

    async passengerCredit(address) {
        const credit = await this.flightSuretyApp.methods
          .getPassengerBalance(address)
          .call({ from: address, gas: 4712388, gasPrice: 100000000000 });
        return this.web3.utils.fromWei(credit);
    }
    
    getPassengerCreditBalanceeEvent(msgcb) {
        this.flightSuretyApp.events.PassengerCreditBalance({ fromBlock: "latest" }, (err, res) => {
            if (err) return msgcb(`Failed getting passenger insurance credit balance. ${err}`);
                const { passenger, credit } = res.returnValues;
                const p = this.getPassenger(passenger);
                msgcb(`Passenger ${p} has insurance credit balance ${credit} eithers.`);
            });
    }
    
    async withdrawCredit(address, amount) {
        return await this.flightSuretyApp.methods
            .withdrawPassengerBalance(this.web3.utils.toWei(amount))
            .send({ from: address });
    }
    
    getWithdrawCreditEvent(msgcb) {
        this.flightSuretyData.events.PassengerWithdrawn({ fromBlock: "latest" }, (err, res) => {
            if (err) return msgcb(`Failed withdrawing credit. ${err}`);
                const { passenger, amount } = res.returnValues;
                const p = this.getPassenger(passenger);
                msgcb(`${p} withdrew ${this.web3.utils.fromWei(amount)} eithers successfully.`);
            });
    }

    async getContractBalances() {
        const dbal = await this.web3.eth.getBalance(this.config.dataAddress);
        const data = this.web3.utils.fromWei(dbal);
        const abal = await this.web3.eth.getBalance(this.config.appAddress);
        const app = this.web3.utils.fromWei(abal);
        return { data, app };
    }
    
    async getBalances() {
        const passengers = [];
        for (let i = 0; i < this.passengersInfo.length; i++) {
            const p = this.passengersInfo[i];
            const b = await this.web3.eth.getBalance(p.address);
            const bal = this.web3.utils.fromWei(b);
            const [n, d] = bal.split(".");
            const den = d ? d.slice(0, 4) : "0000";
            const balance = `${n}.${den}`;
            passengers.push({ ...p, balance });
        }
        return [passengers];
    }

}
