#!/usr/bin/env node
// All rights reserved by MetaBake.org, licensed under LGPL 3.0

import { ExpressRPC } from 'mbake/lib/Serv';
import { EditorRoutes } from './routes/editor';
import { AdminRoutes } from './routes/admin';
import { ADB, Veri } from './lib/ADB';
import { Email } from './lib/Email';
import { Wa } from 'mbake/lib/Wa';
import { VersionNag } from 'mbake/lib/FileOpsExtra'

var ip = require('ip')
var ipAddres = ip.address()

const hostIP = 'http://' + ipAddres + ':'
console.log("TCL: hostIP", hostIP)

var path = require('path');
const fs = require('fs-extra')
const yaml = require('js-yaml');
let config = yaml.load(fs.readFileSync(__dirname + '/config.yaml'));
// ///////////////////////////////////////////////////////

const adbDB = new ADB()
const emailJs = new Email();

const dbName = 'ADB.sqlite'
const pathToDb = path.join(__dirname, dbName)

//try catch of init setup vs running app
try {
   let _this = this
   //check if the file of database exist
   if (adbDB.checkDB(pathToDb)) {
      adbDB.connectToDbOnPort(pathToDb)
         .then(function (port) {
            runAdmin(port)
         })
   } else {
      console.log('open db and run setup')
      //create db file
      adbDB.openDB(pathToDb, runSetup)
   }
} catch (err) {
   console.warn(err)
}

// TODO: should be in a class file in lib folder
function runSetup() { 
   const port = '9081' //init port
   adbDB.connectToDb(pathToDb) //connect to db
   const host = [hostIP + port, config.cors]

   const mainEApp = new ExpressRPC()
   mainEApp.makeInstance(host);


   // mainEApp.handleRRoute("/setup/setup", async (req, res) => {
   mainEApp.handleRRoute('setup',"setup", async (req, res) => {
      const method = req.fields.method;
      let params = JSON.parse(req.fields.params)

      let email = params.email
      let password = params.password
      let emailjsService_id = params.emailjsService_id
      let emailjsTemplate_id = params.emailjsTemplate_id
      let emailjsUser_id = params.emailjsUser_id

      let resp: any = {}; // new response that will be set via the specific method passed
      if ('setup' == method) {
         resp.result = {}
         // res.send(resp)
         try {
            console.info('setup called ...');
            adbDB.addAdmin(email, password, emailjsService_id, emailjsTemplate_id, emailjsUser_id, '9081');
            console.info('db created  ...');
            let msg = 'Hi, your email and password are registered as login credentials for WebAdmin!';
            emailJs.send(email, emailjsService_id, emailjsTemplate_id, emailjsUser_id, msg);
            resp['result'] = 'OK'
            return res.json(resp)

         } catch (err) {
            console.warn(err)
            // next(err);
         }
      } else {
         return res.json(resp);
      }
   })

   mainAppsetup(mainEApp, port)
}

function runAdmin(port) {
   const host = [hostIP + port, config.cors]
   const mainEApp = new ExpressRPC()
   mainEApp.makeInstance(host)
   mainAppsetup(mainEApp, port)
}

function mainAppsetup(mainEApp, port) {
   const eA = new EditorRoutes(mainEApp, adbDB);
   const aA = new AdminRoutes(mainEApp, adbDB);

   mainEApp.handleRRoute('api', 'editors', eA.ROUTES)
   mainEApp.handleRRoute('api', 'admin', aA.ROUTES)

   // mainEApp.handleRRoute('api', 'editors', eA.route.bind(eA));
   // mainEApp.handleRRoute('api', 'admin', aA.route.bind(aA));

   mainEApp.serveStatic(path.join(__dirname, '/'))
     
  
   mainEApp.appInst.listen(port, () => {
      console.log(`======================================================`);
      console.log('To setup Intuition first open: ', hostIP + port + '/setup/');
      console.log('For Admin settings open http: ', hostIP + port + '/admin/');
      console.log('For Editor app open http: ', hostIP + port + '/editors/');
      console.log(`======================================================`);
   })

   // runMBake()

   // endpoint for Uptime monitor
   mainEApp.appInst.get('/monitor', (req, res) => {
      adbDB.monitor()
         .then(res1 => {
            return res.send('OK');
         }).catch(error => {
            console.info('monitor error: ', error);
            res.status(400);
            return res.send = (error);
         });
   });
}

function runMBake() {
   if (typeof adbDB.db !== 'undefined') {
      // run site with mbake
      adbDB
         .getSitePath()
         .then(path => Wa.watch(path[0].pathToSite, 3000))
   }
}

VersionNag.isCurrent('intu', Veri.ver() ).then(function(isCurrent_:boolean){
   try{
   if(!isCurrent_) 
      console.log('There is a newer version of MetaBake\'s intu, please update.')
   else
      console.log('You have the current version of MetaBake\'s intu')
   } catch(err) {
      console.log(err)
   }
})// 
