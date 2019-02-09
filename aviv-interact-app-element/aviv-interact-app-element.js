import {TelepathicElement} from "https://telepathic-elements.github.io/telepathic-element/telepathic-element.js";
import {Web3ServiceLoader} from "https://telepathic-elements.github.io/web3-service-loader/web3-service-loader.js";
export default class AvivInteractAppElement extends TelepathicElement{
    static describe(){return `An element to provide network stats and info for AVIV Tokens.`};
	constructor(fileName,noshadow,delayRender){
        super(fileName,noshadow,delayRender);
        this.statusMsg = "Loading Please Wait...";
        this.estateBal = 0;
        this.estatePrice = 0;
        this.etherBal = 0;
        this.trBal = 0;
        this.tokensOfOwner = [];
        this.tokenLinks = "";
        this.tokensAvailForMint = document.createElement("div");
        this.trAvail = 0;
    }

    static get observedAttributes() {
        return ["token","network","contract"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        //token address and or network, reconnect to infura
        console.log(attrName+" changed, was "+oldVal+" now is "+newVal);
        if(attrName =="contract" || attrName == "token"){
            this.contract.address = newVal;
        }else{
            this[attrName] = newVal;
        }
        this.reset();
    }

    async init(){
        console.debug(`${this.constructor.name} entering init!`);
        let provider = window.web3.currentProvider ? window.web3.currentProvider : "wss://rinkeby.infura.io/ws";
        this.web3 = await Web3ServiceLoader.getInstance(provider);
        console.debug("this.web3: ",this.web3);
    }
    async onReady(){
        console.warn(`${this.constructor.name} entering onReady!`);
        this.estateInfo = await this.loadFileJSON("./js/deployments/estate/estate.deployment.json");
        this.estateABI = await this.loadFileJSON("./js/deployments/estate/estate.abi.json");
        this.trInfo = await this.loadFileJSON("./js/deployments/tr/tr.deployment.json");
        this.trABI = await this.loadFileJSON("./js/deployments/tr/tr.abi.json");
        this.reset();
    }

    async reset(){
        console.debug("Resetting!");
        if(window.provider || window.ethereum){
            this.$.querySelector("#connect-btn").onclick = (evt)=>{this.connectWallet(evt);};
            this.statusMsg = "Press button below to get started!";
        }else{
            this.statusMsg = "Please log into MetaMask and then refresh this page";
        }
    }
    async connectWallet(evt){
        console.debug("Connecting to Wallet! ",evt);
        let x = await window.ethereum.enable();
        console.debug("result: ",x);
        if(Array.isArray(x)){
            window.account = web3.currentProvider.selectedAddress;
            this.statusMsg = "Account "+window.account;
            this.$.querySelector("#connect-btn").style.display = "none";
            this.$.querySelector("#wallet-area").style.display = "block";
            this.$.querySelector("#purchase-btn").onclick = (evt) => {this.purchaseEstates();}
            web3.version.getNetwork(async (err, netId) => {
                switch (netId) {
                  case "1":
                    console.log('This is mainnet');
                    window.network = "mainnet";
                    break
                  case "2":
                    console.log('This is the deprecated Morden test network.');
                    window.network = "morden";
                    break
                  case "3":
                    console.log('This is the ropsten test network.');
                    window.network = "ropsten";
                    break
                  case "4":
                    console.log('This is the Rinkeby test network.');
                    window.network = "rinkeby";
                    break
                  case "42":
                    console.log('This is the Kovan test network.');
                    window.network = "kovan";
                    break
                  default:
                    console.log('This is an unknown network.')
                }
                this.statusMsg += " on "+window.network;
                if(netId !== "4"){
                    window.alert("Unknown network detected! Please switch to Rinkeby and refresh page");
                }

                this.estate = await new this.web3.eth.Contract(this.estateABI, this.estateInfo[window.network],{from: window.account});
                console.debug("estate: ", this.estate);
                this.tr = await new this.web3.eth.Contract(this.trABI, this.trInfo[window.network],{from: window.account});
                console.debug("tr: ", this.tr);
                await this.balances();
                this.estateQty = Math.floor(this.etherBal / this.estatePrice);
                this.estateQty = this.estateQty > 10 ? 10 : this.estateQty;
                window.setInterval(()=>{this.balances()},60000);
              });     
        }
    }

    async balances(){
        this.etherBal = this.web3.utils.fromWei(await this.web3.eth.getBalance(window.account),"ether");
        this.estateBal = await this.estate.methods.balanceOf(window.account).call();
        this.estatePrice = this.web3.utils.fromWei(await this.estate.methods.tokenPrice().call(),"ether");
        
        console.debug("estateBal: ",this.estateBal);
        console.debug("estate price: ",this.estatePrice);
        this.trBal = await this.tr.methods.balanceOf(window.account).call();
        this.tokensUpdate();
        
    }

    async tokensUpdate(){
        this.tokensOfOwner = await this.estate.methods.tokensOfOwner(window.account).call();
        let tokenLinks = "";
        console.debug("tokens held: ",this.tokensOfOwner);
        let tokensAvailForMint = document.createElement("div");
        this.trAvail = 0;
        for(let tokenId of this.tokensOfOwner){
            tokenLinks += `<a href=https://rinkeby.etherscan.io/token/0x39cac5c49fbc5ab963bbad547e605ff7fed2ee1e?a=${tokenId}>${tokenId}</a>&nbsp`;
            let amt = parseInt(await this.tr.methods.canMint(tokenId).call());
            this.trAvail += amt;
            if(amt > 0){
                let tokenBtn = document.createElement("button");
                tokenBtn.innerHTML = tokenId;
                tokenBtn.onclick = (evt)=>{this.mintTR(tokenId);}
                tokensAvailForMint.appendChild(tokenBtn);
            }
        }
        this.tokenLinks = tokenLinks;
        this.tokensAvailForMint = tokensAvailForMint;
        console.debug("tokens for mint: ",this.tokensAvailForMint);
        console.debug("TRs available for mint: ",this.trAvail);
        console.debug("tokenLinks: ",this.tokenLinks);
    }

    async mintTR(tokenId){
        let amt = parseInt(await this.tr.methods.canMint(tokenId).call());
        if(window.confirm("You are about to mint "+amt+" TRs using Estate "+tokenId+" this process can take up to 30 minutes and you cannot mint with Estate "+tokenId+" again for 90 days")){
            await this.tr.methods.mint(tokenId).send();
        }
    }
    async purchaseEstates(){
        
        let block = await this.web3.eth.getBlock("latest");
        let limit = Math.ceil(block.gasLimit * 0.9);
        let gas = 170000 * this.estateQty;
        gas += 170000;
        
        gas = gas > limit ? limit : gas;
        
        
        let price = await this.estate.methods.tokenPrice().call();
        let funding = Math.ceil(this.estateQty * price);
        console.debug(`Sending ${funding} WEI with ${gas} GAS`); 
        let result = await this.estate.methods.issueToken(window.account).send({gas: gas,value: funding});
        console.debug("result of purchase: ",result);
        await this.balances();
    }

    async setAgent(){

    }
}