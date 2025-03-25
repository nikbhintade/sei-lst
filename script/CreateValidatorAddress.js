const ethers = require("ethers");
const { bech32 } = require("bech32");
const axios = require("axios");
const crypto = require("crypto");

const URL = "http://localhost:26657/validators";

async function main() {
    try {
        const response = await axios.get(URL);
        console.log(JSON.stringify(response.data, null, 4));

        // Extract Base64-encoded public key
        const pubKeyBase64 = response.data.validators[0].pub_key.value;

        // Decode Base64 to raw bytes
        const pubKeyBytes = Buffer.from(pubKeyBase64);

        const hash = ethers.keccak256(pubKeyBytes)
        // Take the first 20 bytes (Tendermint address format)
        const addressBytes = hash.slice(0, 20);

        // Convert to Bech32 with 'seivaloper' prefix
        const seiAddress = bech32.encode("seivaloper", bech32.toWords(addressBytes));

        console.log(`Generated Validator Address: ${seiAddress}`);
        console.log(`Generated Address and Acutal Address same: ${"seivaloper1lr8u590ydrwjh3uf547l6h4sxsakvkz94p4kwr" == seiAddress}`);

    } catch (error) {
        // Handle and display errors if the API request fails
        console.error(`-----------------------Error while fetching validators-----------------------\n ${error}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch(
        (error) => {
            console.log(error);
            process.exit(1);
        }
    )