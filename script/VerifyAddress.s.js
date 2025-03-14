const { exec } = require("child_process");
const { ethers } = require("ethers");

function getPrivateKey() {
    return new Promise((resolve, reject) => {
        const command = "echo y | ~/go/bin/seid keys export ta9 --unsafe --unarmored-hex";
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                return reject(`Error: ${error.message}`);
            }
            if (stderr) {
                console.warn(`Warning: ${stderr}`);
            }
            
            const lines = stdout.trim().split("\n");
            const privateKey = lines[lines.length - 1].trim(); // The last line should contain the private key
            resolve(privateKey);
        });
    });
}

function getEvmAddressFromSeid() {
    return new Promise((resolve, reject) => {
        const command = "~/go/bin/seid keys show ta9";
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                return reject(`Error: ${error.message}`);
            }
            if (stderr) {
                console.warn(`Warning: ${stderr}`);
            }
            
            const match = stdout.match(/evm_address:\s+(0x[0-9a-fA-F]+)/);
            if (match) {
                resolve(match[1]);
            } else {
                reject("EVM address not found");
            }
        });
    });
}

async function getAndVerifyPrivateKey() {
    try {
        const privateKey = await getPrivateKey();
        const wallet = new ethers.Wallet(privateKey);
        const derivedAddress = wallet.address;

        console.log("Derived EVM Address:", derivedAddress);

        const evmAddress = await getEvmAddressFromSeid();
        console.log("EVM Address from seid:", evmAddress);

        if (derivedAddress.toLowerCase() === evmAddress.toLowerCase()) {
            return privateKey;
        } else {
            console.log("❌ Addresses do not match!");
        }
    } catch (error) {
        console.error(error);
    }
}

getAndVerifyPrivateKey();
