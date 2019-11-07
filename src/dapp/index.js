
import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";

(async () => {
    let result = null;

    let contract = new Contract("localhost", async error => {
        // Read transaction
        if (error) return (DOM.elid("cos-value").innerHTML = error);

        let isOper;
        const opStatu = DOM.elid("cos-value");
        try {
            isOper = await new Promise(resolve => {
                contract.isOperational((error, result) => {
                    if (error) {
                        opStatu.textContent = "Error! Accessing the contract. Verify it is deployed.";
                        console.log(error);
                        return resolve(false);
                    }
                    opStatu.innerHTML = `${result}`;
                    return resolve(true);
                });
            });
        } catch (e) {
            const msg = "Error! Contract not operational. Details on console.";
            console.log(msg, e);
            opStatu.value = msg;
            return;
        }
        if (!isOper) return;

        await displayBalance(contract);

        displayAirlines(contract, DOM.elid("airlines"));
        DOM.elid("fund-airline").addEventListener("click", () => fa(contract));
        contract.getFundAirlineEvent(msg => displayStatus(msg, "fa"));

        displayAirlines(contract, DOM.elid("airline-address"), 1);
        displayAirlines(contract, DOM.elid("airline-by"));
        DOM.elid("register-airline").addEventListener("click", () => ra(contract));
        contract.getRegisterAirlineEvent(msg => displayStatus(msg, "ra"));

        displayFlights(contract, DOM.elid("flight-number"));
        DOM.elid("register-flight").addEventListener("click", () => rf(contract));
        contract.getRegisterFlightEvent(msg => displayStatus(msg, "rf"));

        displayPassengers(contract, DOM.elid("pi_passengers"));
        displayFlights(contract, DOM.elid("pi_flights"));
        DOM.elid("purchase-insurance").addEventListener("click", () => pi(contract));
        contract.getBuyInsuranceEvent(msg => displayStatus(msg, "pi"));

        displayFlights(contract, DOM.elid("rs-flight"));
        DOM.elid("request-status").addEventListener("click", () => rs(contract));
        contract.getFlightStatusInfoEvent(msg => displayStatus(msg, "rs"));

        displayPassengers(contract, DOM.elid("ci-passengers"));
        DOM.elid("claim-insurance").addEventListener("click", () => ci(contract));
        displayFlights(contract, DOM.elid("ci-flights"));
        contract.getClaimInsuranceEvent(msg => displayStatus(msg, "ci"));
 
        displayPassengers(contract, DOM.elid("dc-passengers"));
        DOM.elid("view-credit").addEventListener("click", () => vc(contract));

        displayPassengers(contract, DOM.elid("wi-passengers"));
        DOM.elid("withdraw-credit").addEventListener("click", () => wi(contract));
        contract.getWithdrawCreditEvent(msg => displayStatus(msg, "wi"));
    });
})();

function displayAirlines(contract, select, dflt) {
    contract.airlinesInfo.map(airline => {
        let option = DOM.makeElement(
            `option`,
            { value: `${airline.address}` },
      `     ${airline.name}`
        );
        select.appendChild(option);
    });
    if (dflt) select.selectedIndex = dflt;
}

function displayFlights(contract, select) {
    contract.flightsInfo.map(flight => {
        const airline = contract.airlinesInfo.filter(
            airline => airline.address === flight.address
        )[0];
        let option = DOM.makeElement(
            `option`,
            {
                dataFlight: `${flight.number}`,
                dataTimestamp: `${flight.timestamp}`,
                dataAirline: `${airline.address}`
            },
      `     ${flight.number} @ ${flight.timestamp} on ${airline.name}`
        );
        select.appendChild(option);
    });
}

function displayPassengers(contract, select) {
    contract.passengersInfo.map(passenger => {
        let option = DOM.makeElement(
            `option`,
            { value: `${passenger.address}` },
      `     ${passenger.name}`
        );
        select.appendChild(option);
    });
}

function getAirline(select) {
    const selected = select.options[select.selectedIndex];
    const airline = selected.getAttribute("value");
    const name = selected.text;
    return { name, airline };
}

const err = (e, msgIn, container) => {
    const msg = `Error, ${msgIn}`;
    console.log(msg, e);
    displayStatus(msg, container);
};

async function fa(contract) {
    const { airline, name } = getAirline(DOM.elid("airlines"));
    const amount = DOM.elid("airline-fund").value;
    let msg = `Funding ${name} Airline.`;
    displayStatus(msg, "fa");
    try {
        await contract.sendFundToAirline(airline, amount);
    } catch (e) {
        err(e, msg, "fa");
    }
    await displayBalance(contract);
}

function displayStatus(msg, dst) {
    removeStatus(dst);
    const btn = DOM.makeElement(
        "btn",
        { class: "btn-clr", id: `${dst}-clear` },
        "Clear"
    );
    const row = DOM.div({ class: "row status", id: `${dst}Status` }, msg);
    row.insertBefore(btn, row.firstChild);
    DOM.elid(dst).appendChild(row);
    DOM.elid(`${dst}-clear`).addEventListener("click", () => removeStatus(dst));
}

function removeStatus(dst) {
    const status = DOM.elid(`${dst}Status`);
    if (status) status.remove();
}

async function ra(contract) {
    const { airline, name } = getAirline(DOM.elid("airline-address"));
    const { airline: byAirline, name: byName } = getAirline(DOM.elid("airline-by"));
    let msg = `${byName} registering ${name}.`;
    displayStatus(msg, "ra");
    try {
        await contract.registerAirline(airline, byAirline);
    } catch (e) {
        err(e, msg, "ra");
    }
    await displayBalance(contract);
}

function getFlight(select) {
    const selected = select.options[select.selectedIndex];
    const flight = selected.getAttribute("dataFlight");
    const timestamp = selected.getAttribute("dataTimestamp");
    const airline = selected.getAttribute("dataAirline");
    const description = selected.text;
    return { airline, flight, timestamp, description };
}

async function rf(contract) {
    const { airline, flight, timestamp, description } = getFlight(
        DOM.elid("flight-number")
    );
    let msg = `Registering flight ${description}.`;
    displayStatus(msg, "rf");
    try {
        await contract.registerFlight(airline, flight, timestamp);
    } catch (e) {
        err(e, msg, "rf");
    }
    await displayBalance(contract);
}

function getPassenger(select) {
    const selected = select.options[select.selectedIndex];
    const address = selected.getAttribute("value");
    const name = selected.text;
    return { name, address };
}

async function pi(contract) {
    const { airline, flight, timestamp, description } = getFlight(
        DOM.elid("pi_flights")
    );
    const { name, address } = getPassenger(DOM.elid("pi_passengers"));
    const amount = DOM.elid("insurance_amount").value;
    let msg = `Buying insurance for ${name} on flight `;
    msg += `${description} for ${amount} ethers.`;
    displayStatus(msg, "pi");
    try {
        await contract.buyInsurance(address, airline, flight, timestamp, amount);
    } catch (e) {
        err(e, msg, "pi");
    }
    await displayBalance(contract);
}

async function rs(contract) {
    const { airline, flight, timestamp, description } = getFlight(
        DOM.elid("rs-flight")
    );
    let msg = `Fetching flight status for ${description}.`;
    displayStatus(msg, "rs");
    try {
        await contract.fetchFlightStatus(airline, flight, timestamp);
    } catch (e) {
        err(e, msg, "rs");
    }
    await displayBalance(contract);
}

async function ci(contract) {
    const { airline, flight, timestamp, description } = getFlight(
        DOM.elid("ci-flights")
    );
    const { name, address } = getPassenger(DOM.elid("ci-passengers"));
    let msg = `Claiming insurance for ${name} on flight ${description}.`;
    displayStatus(msg, "ci");
    try {
        await contract.claimInsurance(address, airline, flight, timestamp);
    } catch (e) {
        err(e, msg, "ci");
    }
    await displayBalance(contract);
}

async function vc(contract) {
    const { name, address } = getPassenger(DOM.elid("dc-passengers"));
    let msg = `Getting insurance refund credit for ${name}.`;
    displayStatus(msg, "dc");
    try {
        const credit = await contract.passengerCredit(address);
        msg = `${name} has a credit of ${credit} ethers.`;
        displayStatus(msg, "dc");
    } catch (e) {
        err(e, msg, "dc");
    }
    await displayBalance(contract);
}

async function wi(contract) {
    const { name, address } = getPassenger(DOM.elid("wi-passengers"));
    const amount = DOM.elid("withdraw-amount").value;
    let msg = `Withdrawing insurance credit ${amount} eithers for ${name}.`;
    displayStatus(msg, "wi");
    try {
        await contract.withdrawCredit(address, amount);
        msg = `${name} has withdrawn a credit of ${amount} ethers.`;
        displayStatus(msg, "wi");
    } catch (e) {
        err(e, msg, "wi");
    }
    await displayBalance(contract);
}

async function displayBalance(contract) {
    try {
        const { data, app } = await contract.getContractBalances();
        DOM.elid("dc-balance").innerHTML = data;
        DOM.elid("ac-balance").innerHTML = app;
        const groups = await contract.getBalances();
        displayBalances(groups);
    } catch (e) {
        console.log("Getting data contract balance failed with error =>", e);
    }
}

async function displayBalances(groups) {
    const grpBndry = [];
    groups.map(group => grpBndry.push(group.length));
    const elements = grpBndry.reduce((a, b) => a + b, 0);

    let idx = 0;
    let group = 0;
    let groupIdx = 0;
    const COLS = 2;
    let ROWS = elements / 2;
    if (elements % ROWS) ROWS++;

    const table = DOM.makeElement(`table`, { id: "removeTable" });
    for (let row = 0; row < ROWS; row++) {
        const tr = DOM.makeElement(`tr`);
        for (let col = 0; col < 2; col++) {
            idx = row + col;
            if (idx === grpBndry[group]) {
                groupIdx = 0;
                group++;
            }
            const item = groups[group][groupIdx];
            let td = DOM.makeElement(`td`, { class: "first" }, item.name);
            tr.appendChild(td);
            td = DOM.makeElement(`td`, item.balance);
            tr.appendChild(td);
            groupIdx++;
        }
        table.appendChild(tr);
    }
    const oldTable = DOM.elid("removeTable");
    if (oldTable) oldTable.parentNode.removeChild(oldTable);
    balances.appendChild(table);
}