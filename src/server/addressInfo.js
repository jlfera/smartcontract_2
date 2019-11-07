/* Ethereum address allocation */

const addressesIsInvalid = (addresses, startIndex, arr, msg) => {
    if (!addresses) {
      console.error(`Error! No addresses provided. ${msg}`);
      return true;
    }
    if (addresses.length < startIndex) {
      console.error(`Error! Start index greater than addresses. ${msg}`);
      return true;
    }
    if (addresses.length < startIndex + arr.length) {
      console.error(`Error! End address greater than addresses. ${msg}`);
      return true;
    }
    return false;
  };
  
  const assignAddresses = (addresses, startIndex, arr) =>
    arr.map((item, index) => ({
      ...item,
      address: addresses[startIndex + index]
    }));
  
  const getAirlines = (addresses, startIndex = 1) => {
    const airlines = [
      { name: "AirAB1" },
      { name: "AirAB2" },
      { name: "AirAB3" },
      { name: "AirAB4" },
      { name: "AirAB5" },
      { name: "AirAB6" },
      { name: "AirAB7" },
      { name: "AirAB8" }
    ];
    if (addressesIsInvalid(addresses, startIndex, airlines, "getAirlines"))
      return null;
    return assignAddresses(addresses, startIndex, airlines);
  };
  
  const getPassengers = (addresses, startIndex = 8) => {
    const passengers = [
      { name: "PAB1" },
      { name: "PAB2" }
    ];
    if (addressesIsInvalid(addresses, startIndex, passengers, "getPassengers"))
      return null;
    return assignAddresses(addresses, startIndex, passengers);
  };
  
  const getFlights = (addresses, startIndex = 1) => {
    // below status is used for testing only
    const flights = [
      { number: "FL1", timestamp: "1554952974", status: 0 },
      { number: "FL2", timestamp: "1554952975", status: 10 },
      { number: "FL3", timestamp: "1554952976", status: 20 },
      { number: "FL4", timestamp: "1554952977", status: 30 },
      { number: "FL5", timestamp: "1554952978", status: 40 },
      { number: "FL6", timestamp: "1554952979", status: 50 },
      { number: "FL7", timestamp: "1554952980", status: 50 }
    ];
    if (addressesIsInvalid(addresses, startIndex, flights, "getAirlines"))
      return null;
    // just assign an airline to a flight
    // nice coincidence same number of flights and airlines. NOT!
    return assignAddresses(addresses, startIndex, flights);
  };
  
  const getOracles = (addresses, startIndex = 10) => {
    const flights = Array(30).fill(null);
    if (addressesIsInvalid(addresses, startIndex, flights, "getAirlines"))
      return null;
    return assignAddresses(addresses, startIndex, flights);
  };
  
  module.exports = {
    getAirlines,
    getPassengers,
    getFlights,
    getOracles
  };
  