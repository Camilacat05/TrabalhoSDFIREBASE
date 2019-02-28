import *  as UUIDS from './constants/uuids';
import * as CmdHeaders from './constants/cmd-headers';
import * as Codes from './constants/codes';
import * as AuthCodes from './constants/authenticationcodes';
import * as FetchCodes from './constants/fetchcodes';
import { Subject, BehaviorSubject, Subscription } from 'rxjs';
import { Buffer } from 'buffer';
import * as CryptoJS from 'crypto-js';
import * as aes from 'aes-js';
import { MiBandTime } from './mibandtime';
import { Utils } from './utils';
import { ActivityFrame } from './activityframe';

import * as moment from 'moment';

import { ExportToCsv } from 'export-to-csv';

const options = { 
    fieldSeparator: ',',
    quoteStrings: '"',
    decimalseparator: '.',
    showLabels: true, 
    useBom: true,
    useKeysAsHeaders: true
  };
const csvExporter = new ExportToCsv(options);

export class MiBand {

    private server: BluetoothRemoteGATTServer = null;
    private key_arr: Array<number>;
    private key: Buffer;
    private is_authenticated$: Subject<string>;
    private fetchState$: BehaviorSubject<string>;

    private fetchDate: MiBandTime;
    private pulledBytes: number;
    private sessionBytes: number;
    private totalBytes: number;
    private fetchCount: number;

    private activityBuffer: ActivityFrame[];

    constructor(server: BluetoothRemoteGATTServer) {
        this.server = server;
        this.key_arr = [0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x40, 0x41, 0x42, 0x43, 0x44, 0x45];
        this.key = Buffer.from(this.key_arr);
        this.is_authenticated$ = new BehaviorSubject<string>(AuthCodes.NO_AUTH);
        this.fetchState$ = new BehaviorSubject<string>(FetchCodes.FETCH);
        this.activityBuffer = [];
        this.pulledBytes = 0;
        this.sessionBytes = 0;
        this.totalBytes = 0;
        this.fetchCount = 0;
        this.init();
    }

    //first authenticate, then start notifications for fetch and activity
    private async init() {
        await this.startNotificationFor(UUIDS.UUID_MIBAND_2_SERVICE, UUIDS.UUID_AUTHORIZATION_CHARACTERISTIC);
        this.authenticate()
        .then(res => {
            if(res){
                this.startNotificationFor(UUIDS.UUID_MIBAND_1_SERVICE, UUIDS.UUID_FETCH_CHARACTERISTIC);
                this.startNotificationFor(UUIDS.UUID_MIBAND_1_SERVICE, UUIDS.UUID_ACTIVITY_CHARACTERISTIC);
                this.enableHRMonitor();
            }
            if(!res){
                console.log("THERE WAS AN ERROR IN AUTHENTICATION");
            }
        })
    }

    //-------------------------------------------HELPER FUNCTIONS-------------------------------------------------------

    //builds an array buffer given arguments
    private AB(...args) {
  
        // Convert all arrays to buffers 
        args = args.map(i => {
        if (i instanceof Array ) {
          return Buffer.from(i);
        }
          return i;
        })
      
        // Merge into a single buffer 
        let buf = Buffer.concat(args);
      
        // Convert into ArrayBuffer
        let ab = new ArrayBuffer(buf.length);
        let view = new Uint8Array(ab);
        for (let i = 0; i < buf.length; ++i) {
          view[i] = buf[i];
        }
        return ab;
      } 

      //starts notification for a specific characteristic
    private async startNotificationFor(serviceUUID: BluetoothServiceUUID, characteristicUUID: BluetoothCharacteristicUUID) {
        await this.getCharacteristic(serviceUUID, characteristicUUID)
            .then(async characteristic => {
                await characteristic.startNotifications();
                characteristic.addEventListener('characteristicvaluechanged', this.handleNotify.bind(this));
                console.log("notifiche attive")
            })
            .catch(error => {
                console.log(error);
            })
    }

    //return characteristic given his uuid
    private async getCharacteristic(serviceUUID: BluetoothServiceUUID, characteristicUUID: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic> {
        
        return this.server.getPrimaryService(serviceUUID)
            .then(service => {
                return service.getCharacteristic(characteristicUUID)
            })
            .catch(error => {
                console.log(error);
                return null;
            })
    }

    //-------------------------------------------------AUTHENTICATION-----------------------------------------------------

    private async authenticate() {
        //send key to miband
        this.sendNewKey();
        //this.requestRandomKey();
        
        return new Promise((resolve) => {
            //if miband doesn't authenticate within 10 seconds, authentication is failed
            var timeout = setTimeout(() => {
                this.is_authenticated$.next(AuthCodes.ERROR);
                authSubscription.unsubscribe();
                resolve(false);
            }, 10000);

            //authentication success
            var authSubscription = this.is_authenticated$.subscribe((auth: string) => {
                if (auth == AuthCodes.AUTH) {
                    clearTimeout(timeout);
                    authSubscription.unsubscribe();
                    resolve(true);
                }
            })
        });
    }

    //request random number from miband
    public async requestRandomNumber(){
        this.getCharacteristic(UUIDS.UUID_MIBAND_2_SERVICE, UUIDS.UUID_AUTHORIZATION_CHARACTERISTIC)
        .then(characteristc => {
            return characteristc.writeValue(this.AB(CmdHeaders.RandomKey))
        })
        .catch(error => {
            console.log(error)
        })
    }

    //send a new key to miband
    public async sendNewKey() {
        this.getCharacteristic(UUIDS.UUID_MIBAND_2_SERVICE, UUIDS.UUID_AUTHORIZATION_CHARACTERISTIC)
        .then(characteristc => {
            return characteristc.writeValue(this.AB(CmdHeaders.SendKey, this.key))
        }) 
        .catch(error => {
            console.log(error)
        })
    }

    //request entirely a random key
    public async requestRandomKey() {
        this.getCharacteristic(UUIDS.UUID_MIBAND_2_SERVICE, UUIDS.UUID_AUTHORIZATION_CHARACTERISTIC)
        .then(characteristc => {
            return characteristc.writeValue(this.AB(CmdHeaders.RandomKey, this.key))
        })
        .catch(error => {
            console.log(error)
        })
    }

    //sends aes encrypted key
    public sendEncryptedKey(buff: Uint8Array) {
        this.getCharacteristic(UUIDS.UUID_MIBAND_2_SERVICE, UUIDS.UUID_AUTHORIZATION_CHARACTERISTIC)
            .then(characteristic => {
                return characteristic.writeValue(this.AB(CmdHeaders.EncryptedKey, Utils.toBuffer(buff.buffer as ArrayBuffer)));
            })
            .catch(error => {
                console.log(error);
            })
    }

    //--------------------------------------------------FETCH DATA---------------------------------------------------------------

    //fetch activity data from miband
    async fetchData(fetchDate: string){

        this.fetchState$.next(FetchCodes.FETCH);
        
        //observe fetch state
        var sub = this.fetchState$
            .subscribe(async (code: string) => {
                console.log(code);
                if(code == FetchCodes.FETCH){
                    console.log("Start fetching")
                    let date = moment(fetchDate, moment.ISO_8601);
                    
                    let lastFetchDate = new MiBandTime([date.get('year'), date.get('month') + 1, date.get('date'), date.get('hours'), date.get('minutes')], false);
                    //console.log("Patient last fetch date: " + lastFetchDate);
                    //console.log("miband fetch date: " + this.fetchDate);
                    await this.startFetching(lastFetchDate);
                }
                else if(code == FetchCodes.READY){
                    await this.sendFetchCmd();
                }
                else if(code == FetchCodes.FINISHED){
                    console.log("Finish SUCCESSFUL");
                    //if activities have been fetched, export a csv file and mibandservice will send it to db
                    if(this.activityBuffer.length > 0){
                        console.log(JSON.stringify(this.activityBuffer))
                        csvExporter.generateCsv(JSON.stringify(this.activityBuffer));
                        this.fetchDate = null;
                        this.fetchUnsubscribe(sub);
                    }
                    //if no data have been fetched, return no data
                    else{
                        console.log("no data available from " + this.fetchDate.toISO8601());
                        this.fetchState$.next(FetchCodes.NO_DATA);
                        this.fetchDate = null;
                    }
                }
                else if(code == FetchCodes.SUCCESS){
                    this.fetchState$.next(FetchCodes.FETCH);
                }
                else if(code == FetchCodes.NO_DATA){
                    this.clearActivityBuffer();
                    this.fetchUnsubscribe(sub);
                }
                else{
                    console.log("Something went terribly wrong");
                    this.clearActivityBuffer();
                    this.fetchUnsubscribe(sub);
                }
            })
    }

    //unsubscribe from fetch status
    fetchUnsubscribe(subscription: Subscription){
        subscription.unsubscribe();
    }

    //start fetching data from a given date
    async startFetching(fetchDate: MiBandTime){
        this.getCharacteristic(UUIDS.UUID_MIBAND_1_SERVICE, UUIDS.UUID_FETCH_CHARACTERISTIC)
            .then(characteristic => {
                return characteristic.writeValue(this.AB([0x01, 0x01], fetchDate.dateToBytes(), [0x00, 0x08]));
            })
            .catch(error => {
                console.log(error);
            });
    }

    //fetch command
    async sendFetchCmd(){
        this.getCharacteristic(UUIDS.UUID_MIBAND_1_SERVICE, UUIDS.UUID_FETCH_CHARACTERISTIC)
            .then(characteristic => {
                return characteristic.writeValue(this.AB([0x02]));
            })
            .catch(error => {
                console.log(error);
            });
    }

    
    public clearActivityBuffer(){
        this.activityBuffer = [];
    }
    

    //-------------------------------------------------HEART RATE-----------------------------------------------------------------

    //enable heart monitor and sleep monitor
    async enableHRMonitor(){
        this.getCharacteristic(UUIDS.UUID_HEART_RATE_SERVICE, UUIDS.UUID_HEART_RATE_CTRL_CHARACTERISTIC)
            .then(async characteristic => {
                console.log("enabling monitor")
                await characteristic.writeValue(this.AB([0x15, 0x00, 0x00]));
                await characteristic.writeValue(this.AB([0x14, 0x00]));
                await characteristic.writeValue(this.AB([0x15, 0x00, 0x01]));
                await characteristic.writeValue(this.AB([0x14, 0x01]));
            })
            .catch(error => {
                console.log(error);
            });
    }

    async disableHRMonitor(){
        this.getCharacteristic(UUIDS.UUID_HEART_RATE_SERVICE, UUIDS.UUID_HEART_RATE_CTRL_CHARACTERISTIC)
            .then(async characteristic => {
                console.log("disabling monitor")
                await characteristic.writeValue(this.AB([0x15, 0x00, 0x00]));
                await characteristic.writeValue(this.AB([0x14, 0x00]));
            })
            .catch(error => {
                console.log(error);
            });
    }

    //-------------------------------------------------BATTERY INFO---------------------------------------------------------------

    public getBatteryInfo(): Promise<DataView>{
        return new Promise((resolve, reject) => {
            this.getCharacteristic(UUIDS.UUID_MIBAND_1_SERVICE, UUIDS.UUID_BATTERY_CHARACTERISTIC)
            .then(characteristic => {
                resolve(characteristic.readValue());
            })
            .catch(error => {
                reject(("Error while getting battery level: " + error));
            })
        })
    }

    //-------------------------------------------------ACCESSORS------------------------------------------------------------------
    public getKeyArr(){
        return this.key_arr;
    }

    public getKey(){
        return this.key;
    }

    public getAuthentication(){
        return this.is_authenticated$;
    }

    public setAuthentication(auth: string){
        this.is_authenticated$.next(auth);
    }

    public getFetchState(){
        return this.fetchState$;
    }

    public getActivityBuffer(){
        return this.activityBuffer;
    }
    //------------------------------------------------NOTIFICATIONS---------------------------------------------------------

    //handle notifications from miband
    public handleNotify(event: Event) {
        var obj: BluetoothRemoteGATTCharacteristic = <BluetoothRemoteGATTCharacteristic>(event.target);
        var buffer: ArrayBuffer = obj.value.buffer;
        //authorization
        if (obj.uuid == UUIDS.UUID_AUTHORIZATION_CHARACTERISTIC) {
            var auth_buffer = buffer.slice(0, 3);
            var auth_view = CryptoJS.lib.WordArray.create(auth_buffer);
            var cmd = CryptoJS.enc.Hex.stringify(auth_view);
            console.log(cmd);
            if (cmd == Codes.RandomKey) {
                //this.requestRandomKey();
                this.requestRandomNumber();
            }
            else if (cmd == Codes.EncryptedKey) {
                console.log("Sending encrypted key");
                //random number from moband
                let rdn = buffer.slice(3);
                //encrpt using aes
                var aesCtr = new aes.ModeOfOperation.ecb(this.key_arr);
                var view = new Uint8Array(rdn);
                var encrypt = aesCtr.encrypt(view);
                this.sendEncryptedKey(encrypt);
            }
            else if (cmd == Codes.Authenticated) {
                //console.log("AUTHENTICATED!");
                this.is_authenticated$.next(AuthCodes.AUTH);
            }
            else if (cmd == Codes.NewKeyFail) {
                console.log("New key failed");
            }
            else if (cmd == Codes.RandomKeyFail) {
                console.log("Random key failed");
            }
            else if (cmd == Codes.SendNewKey) {
                console.log("Sending new key");
                this.sendNewKey();
            }
        }
        //fetch notification
        else if (obj.uuid == UUIDS.UUID_FETCH_CHARACTERISTIC) {
            let buf = buffer.slice(0, 3);
            var view = CryptoJS.lib.WordArray.create(buf);
            var cmd = CryptoJS.enc.Hex.stringify(view);
            console.log(cmd);
            if(cmd == '100204'){
                console.log("Fetch error");
                this.fetchState$.next(FetchCodes.ERROR);
            }
            //miband sends information about activities buffered
            else if (cmd == '100101'){
                //activity frames to send
                let buf_frames_to_send = buffer.slice(3,7);
                //starting date
                let buf_date = buffer.slice(7, 13);
                let view_frames = new DataView(buf_frames_to_send);
                let framesToSend = view_frames.getUint32(0, true);
                this.fetchDate = new MiBandTime(Utils.toBuffer(buf_date), true);
                //if there are activities, miband is ready to fetch
                if(framesToSend > 0){
                    console.log("Fetching " + framesToSend + " frames since " + this.fetchDate.toISO8601());
                    console.log("Fetch round " + this.fetchCount);
                    //this.sendFetchCmd();
                    this.fetchState$.next(FetchCodes.READY);
                }
                else{
                    this.fetchCount = 0;
                    this.sessionBytes = 0;
                    this.totalBytes = 0;
                    this.fetchState$.next(FetchCodes.NO_DATA);
                }
            }
            //finished to fetch
            else if (cmd == '100201'){
                console.log("Pulled " + this.sessionBytes + " bytes this session.");
                this.sessionBytes = 0;
                if(this.fetchDate.minutesUntilNow() > 0){
                    //too much fetch
                    if(this.fetchCount >= 5){
                        console.log("Fetched "+this.fetchCount+" rounds, not fetching any more now");
                        this.fetchCount = 0
                        this.sessionBytes = 0
                        this.totalBytes = 0
                        this.fetchState$.next(FetchCodes.FINISHED);
                    }
                    else{
                        console.log("Fetch successful");
                        this.fetchState$.next(FetchCodes.SUCCESS);
                        this.fetchCount++;
                    }
                }
                else{
                    this.fetchCount = 0;
                    this.sessionBytes = 0;
                    this.totalBytes = 0;
                    this.fetchState$.next(FetchCodes.FINISHED);
                    console.log("Finished fetch")
                }
            }
            else{
                this.fetchCount = 0;
                this.sessionBytes = 0;
                this.totalBytes = 0;
                this.fetchState$.next(FetchCodes.TERMINATED);
                console.log("Error fetching");
            }
        }
        //activity notification
        else if (obj.uuid == UUIDS.UUID_ACTIVITY_CHARACTERISTIC) {
            this.pulledBytes = buffer.byteLength;
            this.sessionBytes += buffer.byteLength;
            this.totalBytes += buffer.byteLength;
            let data = buffer.slice(1);
            //activity data is composed by groups of 4 bytes
            for(let i = 0; i < data.byteLength / 4; i++){
                let frame = data.slice(i*4, (i*4) + 4);
                let view = new DataView(frame);
                let activity: number = view.getUint8(0);
                let intensity: number = view.getUint8(1);
                let steps: number = view.getUint8(2);
                let heart: number = view.getUint8(3);
                if(this.fetchDate){
                    //create activity frame, push into activity buffer and increment fetch time
                    let activityFrame = new ActivityFrame(this.fetchDate.toString(), activity, intensity, steps, heart);
                    this.activityBuffer.push(activityFrame);
                    this.fetchDate.incrementMinute();
                }
            }
        }
        //not recognized notification
        else{
            console.log(obj.uuid + " => " + buffer);