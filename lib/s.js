const http = require('http');
const express = require('express');

const sockjs = require('sockjs');
//const engineio = require('engine.io');

const fs = require('fs');
const path = require('path');
const Command = require('es_command');
const Transactor = require('transactor');
const EtherSheetService = require('./ethersheet_service');
const createTransactionHandler = require('./transaction_handler');
const formidable = require('formidable');

const cookieParser  = require('cookie-parser');
const bodyParser    = require('body-parser');
const cookieSession = require('cookie-session');
const compression   = require('compression');
const _ = require('underscore');
const uuid = require('node-uuid').v4;
const shapeConverter = require('./shapeconverter/shapeconverter');

/*End ISISLab code*/

let ES_CLIENT_PATH = __dirname + '/../node_modules/es_client';
let LAYOUT_PATH    = __dirname + '/layouts';

exports.createServer = function(config){

    /***********************************************
     * EtherSheet HTTP Server
     ***********************************************/
    let app = express();
    //improvement preformance
    app.use(compression());

    let http_server = http.createServer(app);

    // Server Settings
    app.set('views',LAYOUT_PATH);
    app.use('/es_client',express.static(ES_CLIENT_PATH));
    app.use(cookieParser());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(cookieSession({secret: 'app_1'}));

    //improvement preformance
    //app.use('view cache', true);

    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Credentials", true);
        res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type");
        next();
    });

    /***********************************************
     * EtherSheet DB Client
     ***********************************************/
    let es = new EtherSheetService(config);

    // listen after setup
    es.onConnect(function(err){
        if(err) throw err;
        http_server.listen(config.port, config.host, function(){
            console.log('ethersheet is listening over http on port ' + config.port);
            process.send({action: "server_online", pid: process.pid});
        });
    });

    /**********************************************
     * UTILITY FUNCTIONS
     *********************************************/

    function getRow(sheet, cb)
    {
        let i, cols_keys, row_id;
        for(let ri in sheet.rows) {
            //console.log(sheet.rows[ri]);
            //console.log(sheet.cells[sheet.rows[ri]]);
            if (_.isUndefined(sheet.cells[sheet.rows[ri]])) {
                row_id = sheet.rows[ri];
                break;
            }
            cols_keys = Object.keys(sheet.cells[sheet.rows[ri]]);
            for(i=0; i < cols_keys.length; i++){
                if(!_.isEmpty(sheet.cells[sheet.rows[ri]][cols_keys[i]])) break;
            }
            if(i === cols_keys.length - 1) {
                row_id = sheet.rows[ri];
                break;
            }
        }
        if(_.isUndefined(row_id)) {
            row_id = uuid();
            sheet.rows.push(row_id);
            es.setRowIndex(sheet.id, sheet.rows, function (err, data) {
                if(err)
                    cb(err, null);
                else
                    cb(null, row_id);
            });
        }else{
            cb(null, row_id);
        }
    }

    function setColumn(sheet, new_row, cb){
        let new_row_keys =  Object.keys(new_row);
        if (sheet.cols.length < new_row_keys.length) {
            for (let i = 0; i < (new_row_keys.length - sheet.cols.length); i++)
                sheet.cols.push(uuid());
            es.setColIndex(sheet.id, sheet.cols,
                function(err, data)
                {
                    if(err)
                        cb(err);
                    else
                        cb(null);
                }
            );
        }else{
           cb(null);
        }
    }

    function addRowToSheet(sheet, row_id, new_row, cb)
    {
        let new_cells = {};
        let new_row_keys = Object.keys(new_row);
        for(let k = 0; k < new_row_keys.length; k++)
            new_cells[sheet.cols[k]] = { value : new_row[new_row_keys[k]] , type : "string"};
        sheet.cells[row_id] = new_cells;

        es.setCells(sheet.id, sheet.cells, function(err, data){
            if(err)
               cb(err);
            else
               cb(null);
        });
    }

    function helperImportCSV(csv_path, sheet_id, cb) {
        fs.readFile(csv_path, function (err, data) {
            if (err) {
                cb(err);
                return;
            }

            es.createSheetFromCSV(sheet_id, data, function (err) {
                if (err) {
                    cb(err);
                    return;
                }

                cb(null);
            });

        });
    }

    /**********************************************
     * HTTP Routes
     *********************************************/
    //index
    app.get('/', function(req,res){
        res.render('index.ejs', {introText: config.intro_text});
    });

    /*Form stuffs*/
    app.get('/headers/:collection_id', function(req,res){
        es.getSheetCollectionIds(String(req.params.collection_id), function (err, sheet_data) {
            if (!err && typeof sheet_data !== 'undefined' && sheet_data.length == 1) {
                es.refreshDbConnection();
                es.getSheetHeaders(sheet_data[0],function(sheet_data, err){
                    res.send(sheet_data);
                });
            }
        });
    });

    app.post('/init/:collection_id', function(req, res){
        res.setHeader('Content-Type', 'application/json');
        let collection_id = String(req.params.collection_id);
        console.log(req.body);
        es.getSheetCollectionIds(collection_id, function(err, sheet_ids) {
            es.getSheet(sheet_ids[0], function(err, sheet) {
                console.log(sheet.cols);
                sheet.cols.push(uuid());
                es.setColIndex(sheet_ids[0], sheet.cols, function(err, data){
                    res.send(JSON.stringify({
                        status: true,
                        message: "Room initialized"
                    }));
                });
            });
        });
    });

    app.post('/addrow/:collection_id', function(req, res){
        res.setHeader('Content-Type', 'application/json');
        let collection_id = String(req.params.collection_id);
        let new_row       = req.body;
        es.getSheetCollectionIds(collection_id, function(err, sheet_ids) {
            if(err) throw err;
            //console.log(sheet_ids);
            es.getSheet(sheet_ids[0], function(err, sheet) {
                if(err){
                    res.send(JSON.stringify({
                        status: false,
                        message: "There was an error getting sheet"
                    }));
                    throw err;
                }
                /*  console.log("**************************************************");
                console.log("*******************CELLS**************************");
                console.log("**************************************************");
                console.log(sheet.cells);
                console.log("**************************************************");
                console.log("*******************ROWS***************************");
                console.log("**************************************************");
                console.log(sheet.rows);
                console.log("**************************************************");
                console.log("*******************COLS***************************");
                console.log("**************************************************");
                console.log(sheet.cols);
                console.log("**************************************************");
                console.log("*******************XXXX***************************");
                console.log("**************************************************");*/
                getRow(sheet,
                    function(err, row_id){
                       if(err){
                           res.send(JSON.stringify({
                               status: false,
                               message: "There was an error getting new row"
                           }));
                           throw err;
                       }else{
                           setColumn(sheet, new_row,
                           function(err){
                               if(err) {
                                   res.send(JSON.stringify({
                                       status: false,
                                       message: "There was an error getting columns"
                                   }));
                                   throw err;
                               }else{
                                   addRowToSheet(sheet, row_id, new_row,
                                       function(err){
                                           if(err){
                                               res.send(JSON.stringify({
                                                   status: false,
                                                   message: "There was an error creating new cells"
                                               }));
                                               throw err;
                                           }else{
                                               setTimeout(function(){
                                                   pub_server.refreshCollectionIdClients(sheet.id, collection_id);
                                               }, 1000);

                                               res.send(JSON.stringify({
                                                   status: true,
                                                   message: "Row successful added"
                                               }));
                                           }
                                       }
                                   );
                               }
                           });
                       }
                    }
                );
            });
        });
    });

    /* end Form stuff*/

    //convert sheet to csv
    app.get('/export/s/:sheetid.csv', function(req,res){
        let sheet_id = String(req.params.sheetid);

        if(!req.cookies || !req.cookies.JSESSIONID == sheet_id){
            console.log('req.cookies', req.cookies);
            res.cookie('JSESSIONID', sheet_id, { maxAge: 900000, httpOnly: false});
            res.redirect("/s/" + sheet_id);
        }

        es.refreshDbConnection();

        es.sheetToCSV(sheet_id,function(err, sheet_data){
            //res.header('content-type', 'text/csv');
            //res.render('csv.ejs',{ csv:sheet_data});
            //ISISLab fantasy
            res.header('content-type', 'text/csv; charset=utf-8');
            res.send(sheet_data);
            //End ISISLab fantasy
        });
    });

    app.get('/export_to_csv/:collection_id', function(req,res){
        es.getSheetCollectionIds(String(req.params.collection_id), function (err, sheet_data) {
            if (!err && typeof sheet_data !== 'undefined' && sheet_data.length == 1) {
                es.sheetToCSV(sheet_data[0],function(err, sheet_data){
                    res.header('content-type', 'text/csv; charset=utf-8');
                    res.send(sheet_data);
                });
            }
        });
    });

    //<% let ps = JSON.parse(plugins); for(let p in ps) { %>  <script src="/es_client/plugins/<%= ps[p] %>/<%= ps[p] %>.js"></script><% } %>
    //load up the sheet
    app.get('/s/:collection_id', function(req,res){
        let collection_id = String(req.params.collection_id);
        http_server.collection_id = collection_id;
        //Get all plugins
        let plugins = [];
        fs.readdir("./node_modules/es_client/plugins", function(err, items){
            for(let i in items)
                plugins.push(items[i]);
            //console.log(plugins);
            es.refreshDbConnection(
                function(){
                    es.getSheetCollection(collection_id,function(err,sheet_data){
                        if(err)
                            res.send(500,String(err));
                        else
                            res.render('sheet.ejs',{
                                channel          : collection_id,
                                sheet_collection : JSON.stringify(sheet_data),
                                plugins          : JSON.stringify(plugins)
                            });
                    });
                });
        });
    });

    //for test porpouse
    app.get('/sim/:collection_id', function (req,res) {
        let collection_id = String(req.params.collection_id);
        es.getSheetCollection(collection_id,function(err,sheet_data){
            if(err) return res.send(500,String(err));
            res.json(sheet_data);
        });
    });

    //import csv
    app.post('/import/csv', function(req,res){
        let form = new formidable.IncomingForm();
        form.parse(req, function(err, fields, files){
            let csv_path = files.csv_file.path;
            let sheet_id = fields.sheet_id;
            let sheet_name = fields.sheet_name;

            //When the request does not contain the sheet_id,
            //it checks whether there is the sheetName on the url or in the fields.
            if (_.isUndefined(sheet_id) && _.isUndefined(sheet_name)) {
                es.getSheetCollectionIds(sheet_name, function (err, sheet_data) {
                    if (!err && _.isUndefined(sheet_data) && sheet_data.length === 1) {
                        sheet_id = sheet_data[0];

                        helperImportCSV(csv_path, sheet_id, function(err) {

                            if (err) {
                                res.send(500,err.message); return;
                            }

                            setTimeout(function(){
                                res.redirect('back');
                                pub_server.refreshClients(sheet_id);
                            }, 1000);
                        });
                    }
                });
                return;
            }

            helperImportCSV(csv_path, sheet_id, function(err) {
                if (err) { res.send(500,err.message); return; }

                res.redirect('back');
                pub_server.refreshClients(sheet_id);
            });
        });
    });

    //Upload image from a cell
    //Post files
    app.post('/upload/image', function(req, res) {
        res.setHeader('Content-Type', 'application/json');

        let form = new formidable.IncomingForm();
        form.parse(req, function(err, fields, files)
        {
            try {
                let sheet_id = fields.sheet_id;
                let ext = files.image_file.name.split(".");
                let image_name = uuid() + "." + ext[ext.length - 1];
            }catch(e){
                console.log(e);
                res.send(JSON.stringify({ status: false, massage: "There was an error"}));
            }

            fs.readFile(files.image_file.path, function (err, data)
            {
                /// If there's an error
                if(!image_name)
                {
                    console.log("There was an error");
                    res.send(JSON.stringify({ status: false, massage: "There was an error"}));
                }else{
                    let dir     = __dirname +  "/uploads/" + sheet_id;
                    if (!fs.existsSync(dir)){
                        fs.mkdirSync(dir);
                    }

                    let newPath = dir + "/" + image_name;
                    console.log(newPath);

                    fs.writeFile(newPath, data, function (err) {
                        // let's see it
                        console.log("Image uploaded");
                        //let image_url = req.protocol + "://" + req.hostname + ":" + require('../config').port + "/images/" + sheet_id + "/" + image_name;
                        let image_url = req.protocol + "://" + req.hostname + "/ethersheet/images/" + sheet_id + "/" + image_name;
                        res.send(JSON.stringify({ status: true, massage: "Image uploaded", image_url: image_url}));
                    });
                }
            });
        });
    });

    app.post('/remove/image',function (req, res) {
        res.setHeader('Content-Type', 'application/json');
        if(!_.isUndefined(req.body.collection_id) && !_.isUndefined(req.body.image_name))
        {
            let file_path = __dirname +  "/uploads/" + req.body.collection_id + "/" + req.body.image_name;
            fs.unlink(file_path, function (err) {
                if(_.isNull(err)){
                    res.send(JSON.stringify({ status: true, massage: "Image deleted"}));
                }else{
                    res.send(JSON.stringify({ status: false, massage: "There was a problem trying to delete the image"}));
                }
            });
        }else{
            res.send(JSON.stringify({ status: false, massage: "The collection_id or image_name params are mandatory"}));
        }
    });

    app.get('/images/:sheet_id/:image', function (req, res) {
        res.sendFile( __dirname +  "/uploads/" +  String(req.params.sheet_id) + "/" +  String(req.params.image));
    });

    app.get('/images/:collection_id', function (req, res){
        let collection_id = String(req.params.collection_id);
        es.getSheetCollectionIds(collection_id, function(err, sheet_ids){
            let images = [];
            fs.readdir(__dirname +  "/uploads/" + sheet_ids[0], function(err, files){
                for(let i in files)
                    //images.push(req.protocol + "://" + req.hostname + ":" + require('../config').port + "/images/" + sheet_ids[0] + "/" + files[i]);
                    images.push(req.protocol + "://" + req.hostname + "/ethersheet/images/" + sheet_ids[0] + "/" + files[i]);
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({ status: true, massage: "Collection found", images: images}));
            });
        });
    });

    //Media room
    app.post('/mediaroom/init/:collection_id', function(req, res){
        res.setHeader('Content-Type', 'application/json');
        let collection_id = String(req.params.collection_id);
        let form = new formidable.IncomingForm();
        form.parse(req, function(err, fields, files) {
            try{
                es.getSheetCollectionIds(collection_id, function(err, sheet_ids) {
                    es.getSheet(sheet_ids[0], function(err, sheet) {
                        //console.log(sheet.rows);
                        let headers = ["Title", "Description", "Image", "Location", "Date", "User"];
                        _.each(headers, function(h, idx){
                            pub_server.updateCell(collection_id, sheet_ids[0], sheet, 0, idx, h)
                        });
                        //send response
                        res.send(JSON.stringify({
                            status: true,
                            message: "Media room initialized"
                        }));
                    });
                });
            }catch(e){
                console.log(e);
                res.send(JSON.stringify({status: false, message: "There was an error"}));
            }
        });
    });

    //Add new row in the related sheet
    app.post('/mediaroom/addrow/:collection_id', function(req, res) {
        //console.log("ADD ROW SERVICE CALLED");
        res.setHeader('Content-Type', 'application/json');
        let collection_id = String(req.params.collection_id);
        let form = new formidable.IncomingForm();
        form.parse(req, function(err, fields, files) {
            try {
                let collection_id = fields.sheetId;
                let ext = files.image_file.name.split(".");
                let image_name = uuid() + "." + ext[ext.length - 1];
                let row  = {
                    title       : fields.title,
                    description : fields.description,
                    image_name  : image_name,
                    location    : fields.location,
                    date        : fields.date,
                    user        : fields.user
                };
                es.getSheetCollectionIds(collection_id, function(err, sheet_ids) {
                    //Save image file
                    fs.readFile(files.image_file.path, function (err, data) {
                        /// If there's an error
                        if (!row.image_name) {
                            console.log("There was an error");
                            res.send(JSON.stringify({status: false, message: "There was an error"}));
                        } else {
                            let dir = __dirname + "/uploads/" + sheet_ids[0];
                            if (!fs.existsSync(dir)) {
                                fs.mkdirSync(dir);
                            }

                            let newPath = dir + "/" + row.image_name;
                            console.log(newPath);

                            fs.writeFile(newPath, data, function (err) {
                                // let's see it
                                console.log("Image uploaded");

                                //add row
                                es.getSheet(sheet_ids[0], function(err, sheet) {
                                    console.log(Object.keys(sheet.cells).length);
                                    let row_ids = Object.keys(sheet.cells);
                                    let model = es.getModel("sheet",sheet_ids[0]);

                                    //create a new row if it is necessary
                                    let new_row_id = null;
                                    let new_row_idx = 0;
                                    if (row_ids.length === sheet.rows.length) {
                                        new_row_id  = require('../node_modules/es_client/helpers/uid')();
                                        new_row_idx = row_ids.length + 1;
                                        let c = new Command('{"id":"' + sheet_ids[0] +
                                            '","type":"sheet",' +
                                            '"action":"insertRow",' +
                                            '"params":[' + (row_ids.length + 1) + ',"' + new_row_id + '"]}'
                                        );
                                        c.execute(model, function(err){ });
                                    }else{
                                        new_row_id  = sheet.rows[row_ids.length];
                                        new_row_idx = row_ids.length;
                                    }

                                    row.image_name = req.protocol + "://" + req.hostname + "/ethersheet/images/" + sheet_ids[0] + "/" + row.image_name;

                                    _.each(Object.keys(sheet.cells[row_ids[0]]), function(col, col_idx){
                                        pub_server.updateCell(collection_id, sheet_ids[0], sheet, new_row_idx, col_idx, row[Object.keys(row)[col_idx]]);
                                    });

                                    setTimeout(function(){
                                        console.log("sending response");
                                        res.send(JSON.stringify({
                                            status: true,
                                            message: "Row added"
                                        }));
                                    }, 1000);
                                });
                            });
                        }
                    });
                });

            } catch (e) {
                console.log(e);
                res.send(JSON.stringify({status: false, message: "There was an error"}));
            }
        });
    });

    //Shape converter services
    app.post('/import/shape_file', function(req, res) {
        let form = new formidable.IncomingForm();
        form.parse(req, function(err, fields, files) {
            try {
                let sheet_id = fields.sheet_id;
                let ext = files.shape_file.name;
                let image_name = uuid() + "." + ext[ext.length - 1];
            } catch (e) {
                console.log(e);
                res.send(JSON.stringify({status: false, massage: "There was an error"}));
            }

            fs.readFile(files.shape_file.path, function (err, data) {
                let zip = new require('adm-zip')(files.shape_file.path);
                let zipEntries = zip.getEntries();
                zip.extractAllTo("./lib/temp/" + sheet_id, true);
                let c = new shapeConverter.ShapeConverter(__dirname + "/temp/" + sheet_id + "/" + zipEntries[0].entryName.split(".")[0]);
                let CSV = c.convertToCSV();
                if(files.shape_file.size < 3 * 1024 * 1024) {
                    es.createSheetFromCSV(sheet_id, CSV, function (err) {
                        if (err)
                            console.log(err);
                        res.redirect('back');
                        pub_server.refreshClients(sheet_id);
                    });
                }else{
                    res.header('content-type', 'text/csv; charset=utf-8');
                    res.send(CSV);
                }
            });
        });

    });

    /***********************************************
     * PubSub Server
     ***********************************************/
    let killTimeout = null;
    let active_clients = 0;
    let pub_server = new Transactor();
    let transactionHandler = createTransactionHandler(es);

    pub_server.onTransaction(function(channel,socket,command_string,cb){
        let c = new Command(command_string);

        if(c.getDataType()=='user' && c.getAction()=='addUser'){
            let id = c.getParams()[0].id;
            socket.es_user_id = id;
        }
        transactionHandler(c,cb);
    });

    pub_server.onClose(function(channel,socket){
        let close_msg = {
            type:'user',
            action:'removeUser',
            params:[{
                id: socket.es_user_id
            }]
        };
        let close_command = Command.serialize(close_msg);
        pub_server.broadcast(socket,channel,close_command);

        active_clients--;
        //console.log("CLIENTS: " + active_clients);
        if(active_clients === 0) {
            killTimeout = setTimeout(function () {
                console.log("kill worker");
                process.exit();
            }, 1000 * 60 * 15);
            //process.exit();
        }
        //console.log(active_clients);
    });

    pub_server.refreshClients = function(sheet_id){
        let refresh_msg = {
            type: 'sheet',
            id: sheet_id,
            action: 'refreshSheet',
            params:[]
        };
        let refresh_command = Command.serialize(refresh_msg);
        pub_server.broadcast(null,sheet_id,refresh_command);
        console.log('sending refresh command');
    };

    pub_server.updateCells = function(cellKeys, cellValues, new_row_idx, collection_id, sheet_id, sheet, callback){
        _.each(cellKeys), function(col, col_idx){
            pub_server.updateCell(collection_id, sheet_id, sheet, new_row_idx, col_idx, cellValues[col_idx]);
        }
    };

    //utility function
    pub_server.updateCell = function( collection_id, sheet_id, sheet, row_idx, col_idx, value )
    {
        let update_cell_command = new Command('{"id":"' + sheet_id + '",' +
            '"type":"sheet",' +
            '"action":"updateCell",' +
            '"params":["' + sheet.rows[row_idx] + '","'
            + sheet.cols[col_idx] + '",' +
            '{"value":"' + value + '","type":"string"}]}');

        let commit_cell_command = new Command('{"id":"' + sheet_id + '",' +
            '"type":"sheet",' +
            '"action":"commitCell",' +
            '"params":["' + sheet.rows[row_idx] + '","'
            + sheet.cols[col_idx] + '",' +
            '{"value":"' + value + '","type":"string"}]}');

        setTimeout(function () {
            transactionHandler(update_cell_command, function(err, command){
                pub_server.broadcast(null, collection_id, command);
                setTimeout(function () {
                    transactionHandler(commit_cell_command, function(err, command){
                        /*console.log("Err: " +  err);
                         console.log("Command: " +  command);
                         pub_server.broadcast(null, collection_id, Command.serialize(command));*/
                    })
                }, 500);
            })
        }, 500);
    };

    pub_server.refreshCells = function(collection_id, sheet_id)
    {
        let refresh_msg = {
            type: 'sheet',
            id: sheet_id,
            action: 'refreshCells',
            params:[]
        };

        let refresh_cells_command = Command.serialize(refresh_msg);
        pub_server.broadcast(null, collection_id ,refresh_cells_command);
        console.log('sending refresh cells command');

       /* transactionHandler(refresh_cells_command, function(err, command){
            if(err) throw err;
            pub_server.broadcast(null, collection_id ,command);
            console.log('sending refresh cells command');
        });*/

    };

    pub_server.refreshCollectionIdClients = function(sheet_id, collection_id){
        let refresh_msg = {
            type: 'sheet',
            id: sheet_id,
            action: 'refreshSheet',
            params:[]
        };
        let refresh_command = Command.serialize(refresh_msg);
        pub_server.broadcast(null,collection_id,refresh_command);
        console.log('sending refresh command');
    };

    /***********************************************
     * Websocket Server
     ***********************************************/
    let ws_server = sockjs.createServer();
    ws_server.installHandlers(http_server,{prefix:'.*/pubsub', headers: {'accept': '*/*'}});

    ws_server.on('connection', function(socket){
        let channel = socket.pathname.split('/')[1];
        console.log("new connection channel: " + channel);
        pub_server.addSocket(channel,socket);
        active_clients++;
        clearTimeout(killTimeout);
        //console.log(active_clients);
    });

    return http_server;
};