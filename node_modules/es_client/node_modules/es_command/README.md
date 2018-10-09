````javascript
Command = require('es_command');

// create either from json
msg_string = '{"id":"123","type":"user","action":"setName","params":["ricky"]}';
command = new Command(msg_string);

// or from a hash
msg = {
  id: 123,
  type: "user",
  action: "setName",
  params: ["ricky"]
};
command = new Command(msg);

// Accessors
command.getDataId() // 123
command.getDataType() // "user"
command.getAction() // "setName"
command.getParams() //  ["ricky"]
command.getMessage() // message in hash format
command.getSerializedMessage() // message in json format

// Execute

// run the command's action on a given object
command.execute(current_user); 

// if the command accepts a callback, you can do async/chaining
command.execute(current_user,function(err,result){

  // the command calls current_user.setName("ricky",cb)
  // and setName would run this code whenever it would run cb()

});
````