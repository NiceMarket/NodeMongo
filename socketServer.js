const Max_AllowOnlineMan = 2048;
const Min_MsgLen = 7;
const Min_SendMsgLen = 4;
const send_secsize = 1024;
const ErrorBrokenTime = 20;
const CheckCountBrokenTime = 3;
const Max_BattleRoom = 1024;
  
var zlib = require('zlib');
var util = require('util');
var gamedb = require('./database');

var util = require('util');
var express = require('express');
var partials = require('express-partials');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var app = express();

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.bodyParser());
app.use(partials());
app.use(express.cookieParser());
app.use(express.session({secret: 'abc123'}));
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);

var httpServer = http.createServer(app).listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});

httpServer.setMaxListeners(Max_AllowOnlineMan);

var io = require('socket.io')(httpServer);

io.on('connection', OnConnection);

var FreeSockNum = Max_AllowOnlineMan-1;
var UsedSockets = [];
var FreeSockets = [];
var NetMsgProcess = [,];

var FreeRoomNum = Max_BattleRoom-1;
var BattleRooms = [];
var FreeRooms = [];

Init_Server_Net();
Init_NetMsgProcess();
Init_Room();

function OnConnection(socket) {
	try {
		socket.on('message', OnMessage);
		socket.on('disconnect', OnSocketDisconnect);
		socket.on('error', OnSocketError);

		var who = Get_EmptyWho();
		if (CheckWho(who)) {
			console.log('OnConnection ' + who);
			socket['Who'] = who;
			UsedSockets[who].Who = who;
			UsedSockets[who].CheckConnect = 0;
			UsedSockets[who].Socket = socket;
		};
	} catch (e) {
		console.log(e);
	};
}

function OnSocketDisconnect() {
	try {
		console.log('OnSocketDisconnect ' + this.Who);
		var buf = WriteByteToBuffer(3);
		var whoBuf = WriteUShortToBuffer(this.Who);
		SendToAllWithoutWho(1, 1, this.Who, Buffer.concat([buf, whoBuf]));
		
		Free_User_Socket(this.Who);
	} catch (e) {
		console.log(e);
	};
}

function OnSocketError(err) {
	try {
		console.log('OnSocketError ' + this.Who + err);
	} catch (e) {
		console.log(e);
	};
}

function OnSocketEnd() {
	try {
		console.log('OnSocketEnd ' + this.Who);
	} catch (e) {
		console.log(e);
	};
}

function OnSocketTimeout() {
	try {
		console.log('OnSocketTimeout ' + this.Who);
	} catch (e) {
		console.log(e);
	};
}

function OnMessage(packet) {
	try {
		var who = this.Who;
		if (CheckWho(who)) {
			var message = new Buffer(packet.data);
			if (message.length + UsedSockets[who].RecSize <= UsedSockets[who].RecBuffer.length) {
				message.copy(UsedSockets[who].RecBuffer, UsedSockets[who].RecSize);
				UsedSockets[who].RecSize += message.length;
			}
			
			while(UsedSockets[who].RecSize >= Min_MsgLen)
			{
				var index = UsedSockets[who].RecIndex;
				var c0 = UsedSockets[who].RecBuffer.readUInt8(index+0);
				var c1 = UsedSockets[who].RecBuffer.readUInt8(index+1);
				var c2 = UsedSockets[who].RecBuffer.readUInt8(index+2);
				if (c0 == 91 && c1 == 94 && c2 == 37) {
					var len = UsedSockets[who].RecBuffer.readInt16LE(index+3);
					if (UsedSockets[who].RecSize - index < len - Min_MsgLen)
						return;
					
					var protocol = message.readUInt8(index+5);
		            var kind = message.readUInt8(index+6);
		            UsedSockets[who].RecIndex += Min_MsgLen;
		            try {
		            	if (NetMsgProcess[protocol, kind] != null) {
							if (protocol == 1 && kind == 1)
								NetMsgProcess[protocol, kind](who);
							else //Verified
							if (UsedSockets[who].TeamName) 
								NetMsgProcess[protocol, kind](who);
							else {
				            	console.log('Not loggin protocol ' + who);
							};
						};
		            } catch (e) {
		            	UsedSockets[who].RecSize = 0;
						UsedSockets[who].RecIndex = 0;
		            	console.log('protocol ' + protocol + ' kind ' + kind + 'error');
		            	break;
		            }
		            
		            UsedSockets[who].RecIndex += len;
		            if (UsedSockets[who].RecIndex >= UsedSockets[who].RecSize) {
		            	UsedSockets[who].RecSize = 0;
						UsedSockets[who].RecIndex = 0;
		            } else
		            	console.log('Over 2 protocol ' + this.Who);
				} else {
					UsedSockets[who].RecSize = 0;
					UsedSockets[who].RecIndex = 0;
					console.log('OnMessage header incorrect ' + this.Who + message);
					break;
				};
			};
		};
	} catch (e) {
		console.log(e);
	};
}

function Init_Server_Net() {
	for (var i = 0; i < Max_AllowOnlineMan; i++) {
		UsedSockets.push({'Who': -1, 'Socket': null, 'RecIndex': 0, 'RecSize': 0, 'RecBuffer': new Buffer(1024), 'CheckConnect': 0,
					   'TeamID': '', 'TeamName': '', 'Popularity': 0, 'Conference': 0, 'BasketLv': 0,
					   'FightTeam': '', 'RoomIndex': -1,});
		
		FreeSockets.push(Max_AllowOnlineMan-i-1);
	};
}

function CheckWho(who) {
	if (who >= 0 && who < FreeSockets.length)
		return true;
	else
		return false;
}

function Get_EmptyWho() {
	if (CheckWho(FreeSockNum)) {
		FreeSockNum--;
		return FreeSockets[FreeSockNum+1];
	} else
		return -1;
}

function Free_User_Socket(who) {
	if (CheckWho(who)) {
		FreeSockNum++;

		if (CheckWho(FreeSockNum)) {
			var rindex = UsedSockets[who].RoomIndex;
			if (CheckRoom(rindex)) {
				for (var i = 0; i < BattleRooms[rindex].Players.length; i  ++) 
					if (BattleRooms[rindex].Players[i] == who) 
						BattleRooms[rindex].Players[i] = -1;

				var flag = true;
				for (var i = 0; i < BattleRooms[rindex].Players.length; i  ++) 
					if (BattleRooms[rindex].Players[i] > -1) {
						flag = false;
						break;
					}
				
				if (flag) 
					FreeUsedRoom(rindex);
			}
			
			FreeSockets[FreeSockNum] = who;
			UsedSockets[who].Who = -1;
			UsedSockets[who].TeamID = '';
			UsedSockets[who].TeamName = '';
			UsedSockets[who].Socket = null;
			UsedSockets[who].RecIndex = 0;
			UsedSockets[who].RecSize = 0;
			UsedSockets[who].RoomIndex = -1;
    	};
	};
}

function Init_Room() {
	for (var i = 0; i < Max_BattleRoom; i++) {
		BattleRooms.push({'Index': -1, 'Players': [], 'Scores': [], 'BasketLv': [], 'Start': [], 'StartTime': new Date(), 'IsStart': false, 'BallIndex': -1,});
		
		BattleRooms[i].Players.push(-1);
		BattleRooms[i].Players.push(-1);
		BattleRooms[i].Scores.push(0);
		BattleRooms[i].Scores.push(0);
		BattleRooms[i].Start.push(false);
		BattleRooms[i].Start.push(false);
		
		FreeRooms.push(Max_BattleRoom-i-1);
	};
}

function CheckRoom(index) {
	if (index >= 0 && index < FreeRooms.length)
		return true;
	else
		return false;
}

function Get_EmptyRoom() {
	if (CheckRoom(FreeRoomNum)) {
		FreeRoomNum--;
		return FreeRooms[FreeRoomNum+1];
	} else
		return -1;
}

function FreeUsedRoom(index) {
	if (CheckRoom(index)) {
		FreeRoomNum++;

		if (CheckRoom(FreeRoomNum)) {
			FreeRooms[FreeRoomNum] = index;
			BattleRooms[index].Index = -1;
			BattleRooms[index].Players[0] = -1;
			BattleRooms[index].Players[1] = -1;
			BattleRooms[index].Scores[0] = 0;
			BattleRooms[index].Scores[1] = 0;
			BattleRooms[index].BasketLv[0] = 0;
			BattleRooms[index].BasketLv[1] = 0;
			BattleRooms[index].Start[0] = false;
			BattleRooms[index].Start[1] = false;
			BattleRooms[index].IsStart = false;
    	}
	}
}

function Init_NetMsgProcess() {
	NetMsgProcess['1', '1'] = netmsg_001_001;
}

//Setting and clearing an interval
var interval60 = setInterval(TimeEvent60, 60000);

function TimeEvent60() {
	var now = new Date();
	var hours = now.getUTCHours();
	var min = now.getMinutes();
	
	if (hours == 12) {
		if (min == 0) {
			console.log('Match start ' + now);
			var no = WriteByteToBuffer(1);
			var state = WriteByteToBuffer(1);
			SendToAll(1, 14, Buffer.concat([no, state]));
		} else
		if (min == 30) {
			console.log('Match finished ' + now);
			var no = WriteByteToBuffer(1);
			var state = WriteByteToBuffer(0);
			SendToAll(1, 14, Buffer.concat([no, state]));
		};
	};
}

function WriteProtocol(protocol, kind, buffer) {
	buffer.writeUInt16LE(1, 0);
	buffer.writeUInt8(protocol, 2);
	buffer.writeUInt8(kind, 3);
}

function CanSend(who) {
	return CheckWho(who) && UsedSockets[who].Socket && UsedSockets[who].Socket.client && UsedSockets[who].Socket.client.conn && UsedSockets[who].Socket.client.conn.readyState == 'open';
}

function SendBuffer(who, buf) {
	try {
	var jsonStr = JSON.stringify(buf);
	var data = {data: jsonStr};
	UsedSockets[who].Socket.emit('message', data);
	} catch (e) {
		console.log(e);
	};
}

function SendToAll(protocol, kind, buf) {
	var buffer = new Buffer(Min_SendMsgLen);
	WriteProtocol(protocol, kind, buffer);
	
	if (buf) {
		buffer.writeUInt16LE(buf.length, 0);
		buffer = Buffer.concat([buffer, buf]);
	} else
		buffer.writeUInt16LE(0, 0);
	
	for (var i = 0; i < UsedSockets.length; i++)
		if (CanSend(UsedSockets[i].Who)) {
			try {
			SendBuffer(i, buffer);
			} catch (e) {
				console.log(e);
			};
		};
}

function SendToAllWithoutWho(protocol, kind, who, buf) {
	var buffer = new Buffer(Min_SendMsgLen);
	WriteProtocol(protocol, kind, buffer);
	buffer.writeUInt16LE(buf.length, 0);
	buffer = Buffer.concat([buffer, buf]);
	
	for (var i = 0; i < UsedSockets.length; i++)
		if (i != who && CanSend(UsedSockets[i].Who)) {
			try {
			SendBuffer(i, buffer);
			} catch (e) {
				console.log(e);
			};
		};
}

function SendToAllWaiting(protocol, kind, buf) {
	var buffer = new Buffer(Min_SendMsgLen);
	WriteProtocol(protocol, kind, buffer);
	buffer.writeUInt16LE(buf.length, 0);
	buffer = Buffer.concat([buffer, buf]);
	
	for (var i = 0; i < UsedSockets.length; i++)
		if (CanSend(UsedSockets[i].Who)) {
			try {
			SendBuffer(i, buffer);
			} catch (e) {
				console.log(e);
			};
		};
}

function SendToRoom(protocol, kind, buf, roomIndex) {
	if (CheckRoom(roomIndex)) {
		var buffer = new Buffer(Min_SendMsgLen);
		WriteProtocol(protocol, kind, buffer);
		buffer.writeUInt16LE(buf.length, 0);
		buffer = Buffer.concat([buffer, buf]);
		
		for (var i = 0; i < BattleRooms[roomIndex].Players.length; i++) {
			var who = BattleRooms[roomIndex].Players[i];
			if (CheckWho(who)) { 
				if (CanSend(who))
					SendBuffer(who, buffer);
			};
		};
	};
}

function SendToClient(protocol, kind, who, buf) {
	if (CheckWho(who)) {
		var buffer = new Buffer(Min_SendMsgLen);
		WriteProtocol(protocol, kind, buffer);
		
		if (buf) {
			buffer.writeUInt16LE(buf.length, 0);
			buffer = Buffer.concat([buffer, buf]);
		} else
			buffer.writeUInt16LE(0, 0);
		
		if (CanSend(who)) {
			try {
			SendBuffer(who, buffer);
			} catch (e) {
				console.log(e);
			};
		};
	};
}

function SendResultToClient(protocol, kind, result, who) {
	if (CheckWho(who)) {
		var buffer = new Buffer(Min_SendMsgLen+1);

		WriteProtocol(protocol, kind, buffer);
		buffer.writeUInt8(result, 4);
		
		if (CanSend(who)) 
			SendBuffer(who, buffer);
	}
}

function ReadByte(who) {
	try {
		if (CheckWho(who)) {
			UsedSockets[who].RecIndex++;
			return UsedSockets[who].RecBuffer.readUInt8(UsedSockets[who].RecIndex-1);
		} else
			return 0;
	} catch (e) {
		console.log('ReadByte error' + e);
		return 0;
	};
}

function ReadUShort(who) {
	try {
		if (CheckWho(who)) {
			UsedSockets[who].RecIndex += 2;
			return UsedSockets[who].RecBuffer.readUInt16LE(UsedSockets[who].RecIndex-2);
		} else
			return 0;
	} catch (e) {
		console.log('ReadUShort error' + e);
		return 0;
	};
}

function ReadInt(who) {
	try {
		if (CheckWho(who)) {
			UsedSockets[who].RecIndex += 4;
			return UsedSockets[who].RecBuffer.readInt32LE(UsedSockets[who].RecIndex-4);
		} else
			return 0;
	} catch (e) {
		console.log('ReadInt error' + e);
		return 0;
	};
}

function Readfloat(who) {
	try {
		if (CheckWho(who)) {
			UsedSockets[who].RecIndex += 4;
			return UsedSockets[who].RecBuffer.readFloatLE(UsedSockets[who].RecIndex-4);
		} else
			return 0;
	} catch (e) {
		console.log('Readfloat error' + e);
		return 0;
	};
}

function ReadString(who) {
	try {
		if (CheckWho(who)) {
			var len = ReadByte(who);
			if (UsedSockets[who].RecSize >= UsedSockets[who].RecIndex + len) {
				var slice = UsedSockets[who].RecBuffer.slice(UsedSockets[who].RecIndex, UsedSockets[who].RecIndex + len);
			    var str = "";
			    for(var i = UsedSockets[who].RecIndex; i < UsedSockets[who].RecIndex + len; i += 2) {
			        var char = UsedSockets[who].RecBuffer[i];
			        if (UsedSockets[who].RecBuffer[i + 1]) {
			        	var char2 = UsedSockets[who].RecBuffer[i + 1] << 8;
			            char += char2;
			        }
			        
			        str += String.fromCharCode(char);
			    }
	
			    UsedSockets[who].RecIndex += len;
			    
				return str;
			} else
				return '';
		} else
			return '';
	} catch (e) {
		console.log('ReadString error' + e);
		return '';
	};
}

function ReadAll(who) {
	try {
		if (CheckWho(who) && UsedSockets[who].RecIndex > 2) {
			var index = UsedSockets[who].RecIndex;
			var len = UsedSockets[who].RecBuffer.readInt16LE(UsedSockets[who].RecIndex-4);
			UsedSockets[who].RecIndex += len;
			return UsedSockets[who].RecBuffer.slice(index, UsedSockets[who].RecIndex);
		} else
			return new Buffer(0);
	} catch (e) {
		console.log('ReadAll' + e);
		return 0;
	};
}

function WriteByteToBuffer(data) {
	try {
		if (data != undefined && data != null) {
			data = parseInt(data, 10);
			var buf = new Buffer(1);
			buf.writeUInt8(data, 0);
			return buf;
		} else
			return new Buffer(0);
	} catch (e) {
		console.log('WriteByteToBuffer error ' + e);
		return new Buffer(0);
	};
}

function WriteUShortToBuffer(data) {
	try {
		if (data != undefined && data != null) {
			data = parseInt(data, 10);
			var buf = new Buffer(2);
			buf.writeUInt16LE(data, 0);
			return buf;
		} else
			return new Buffer(0);
	} catch (e) {
		console.log('WriteUShortToBuffer error ' + e + data);
		return new Buffer(0);
	};
}

function WriteIntToBuffer(data) {
	try {
		if (data != undefined && data != null) {
			data = parseInt(data, 10);
			var buf = new Buffer(4);
			buf.writeInt32LE(data, 0);
			return buf;
		} else
			return new Buffer(0);
	} catch (e) {
		console.log('WriteIntToBuffer error ' + e);
		return new Buffer(0);
	};
}

function WriteFloatToBuffer(data) {
	try {
		if (data != undefined && data != null) {
			var buf = new Buffer(4);
			buf.writeFloatLE(data, 0);
			return buf;
		} else
			return new Buffer(0);
	} catch (e) {
		console.log('WriteFloatToBuffer error ' + e);
		return new Buffer(0);
	};
}

function WriteStringToBuffer(str) {
	try {
		if (str && str.length && str.length < send_secsize) {
			var strBuf = new Buffer(str, 'utf8');
			var lenBuf = WriteUShortToBuffer(strBuf.length);
			return Buffer.concat([lenBuf, strBuf]);
		} else
			return new Buffer(0);
	} catch (e) {
		console.log('WriteStringToBuffer error ' + e);
		return new Buffer(0);
	};
}

function Get_TeamInformation(i) {
	if (UsedSockets[i].TeamName != '' && UsedSockets[i].FightTeam == '') {
		var buf = WriteUShortToBuffer(UsedSockets[i].Who);
		var conBuf = WriteByteToBuffer(UsedSockets[i].Conference);
		buf = Buffer.concat([buf, conBuf]);
		
		var popuBuf = WriteUShortToBuffer(UsedSockets[i].Popularity);
		buf = Buffer.concat([buf, popuBuf]);
		
		var strBuf = WriteStringToBuffer(UsedSockets[i].TeamName);
		return Buffer.concat([buf, strBuf]);
	} else
		return new Buffer(0);
}

function Get_RoomTeamList() {
	try {
		var count = 0;
		var buf = new Buffer(0);
		for (var i = 0; i < UsedSockets.length; i ++) {
			if (UsedSockets[i].TeamName != '' && UsedSockets[i].FightTeam == '') {
				var teamBuf = Get_TeamInformation(i);
				buf = Buffer.concat([buf, teamBuf]);
				
				count++;
			};
		}
		
		var lenBuf = WriteUShortToBuffer(count);
		return Buffer.concat([lenBuf, buf]);
	} catch (e) {
		console.log(e);
	};
}

function netmsg_001_001(who) {
	try {
		var teamID = ReadString(who);
		var session = ReadString(who);
		if (UsedSockets[who].TeamID == '') {
			UsedSockets[who].TeamID = teamID;
			SendResultToClient(1, 1, 1, who);
		} else 
			SendResultToClient(1, 1, 4, who);
	} catch (e) {
		console.log(e);
	};
}