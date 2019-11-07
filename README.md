# Project FlightSurety
Using Windows 8

## Install
`npm install`

`truffle version`:

Truffle v5.0.8 (core: 5.0.8)
Solidity - ^0.4.24 (solc-js)
Node v10.16.3
Web3.js v1.0.0-beta.37

`truffle compile`

To run truffle tests:

`ganache-cli -a 50 -m "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"`

`truffle test ./test/flightSurety.js`
`truffle test ./test/oracles.js`

To use the dapp:

`truffle migrate`
`npm run dapp`

To view dapp:

`http://localhost:8000`

## Develop Server

`npm run server`
`truffle test ./test/oracles.js`

## Deploy

To build dapp for prod:
`npm run dapp:prod`