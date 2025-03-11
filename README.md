# Sei Liquid Staking

-   [x] Find out how to access auto generated account of Sei local node
-   [ ] Integrate hardhat with our foundry project
-   [ ] Write test that and try to run it on the local node

## Notes

Some of the following commands won't work unless the local node is running so make sure you have the local node running in the background.

Run local chain:

```bash
cd ~/sei-chain # PATH may vary in your development environment
./scripts/initialize_local_chain.sh
```

Get list of accounts:

```bash
~/go/bin/seid keys list
```

Get details of single account by account name (name in order and starts from ta0 and goes upto ta9)

```bash
> ~/go/bin/seid keys show ta9
- name: ta9
  type: local
  address: sei1m5x785z6r2j9fduhl8sv252usxlcf6q4hhk028
  evm_address: 0x72906E861d2D753e4CCF0034024ba5e0878066dC
  pubkey: '{"@type":"/cosmos.crypto.secp256k1.PubKey","key":"A8dDLApUKWMpBIMqBeC4hgpq74Ttc2ZH/cd13oOKZ+Rf"}'
  mnemonic: ""
```

Check balance of the account using Sei (Cosmos) Address:

```bash
~/go/bin/seid query bank balances sei1m5x785z6r2j9fduhl8sv252usxlcf6q4hhk028
```

Note that when we initialize local node with `initialize_local_chain.sh` script it regenerates all the accounts so if you're using privaate from previous session then there is a chance that the account is not one of 10 which got initial balance on local node. In short whenever you start the local node you have to update the private key of account that is being used for testing.
