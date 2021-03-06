/**
 * Created by zhengguorong on 16/7/20.
 */
var request = require('request');
var server = require('./index');
var userApi = require('./user');
var schedule = require('node-schedule');
var email = require('../utils/mail');
var moment = require('moment');

//获取打卡信息
var getPunchCard=function(params,success){
    request.post({url:server.domain+"/attendance/getPunchCard?"+server.getSignParams(),
        headers: {"Content-Type": 'application/json'},body:JSON.stringify(params)}, function(err, response, body) {
        if(err) { console.log(err); return; }
        success(response,JSON.parse(body))
    });
}
//是否已经打卡
var isPunchCard = function(params,success){
    request.post({url:server.domain+"/attendance/isPunchCard?"+server.getSignParams(),
        headers: {"Content-Type": 'application/json'},body:JSON.stringify(params)}, function(err, response, body) {
        if(err) { console.log(err); return; }
        success(response,JSON.parse(body))
    });
}
//获取二维码信息
var checkScanCode = function(params,success){
    request.post({url:server.domain+"/attendance/checkScanCode?"+server.getSignParams(),
        headers: {"Content-Type": 'application/json'},body:JSON.stringify(params)}, function(err, response, body) {
        if(err) { console.log(err); return; }
        success(response,JSON.parse(body))
    });
}
//上班/下班打卡请求
var confirmAttendanceSever = function(params,success){
    request.post({url:server.domain+"/attendance/confirmAttendance?"+server.getSignParams(),
        headers: {"Content-Type": 'application/json'},body:JSON.stringify(params)}, function(err, response, body) {
        if(err) { console.log(err); return; }
        success&&success(response,JSON.parse(body))
    });
}
//获取历史打卡信息
var getPunchCardList = function (params,success) {
    request.post({url:server.domain+"/attendance/getPunchCardList?"+server.getSignParams(),
        headers: {"Content-Type": 'application/json'},body:JSON.stringify(params)}, function(err, response, body) {
        if(err) { console.log(err); return; }
        success(response,JSON.parse(body))
    });
}
//保存工作日志
var confirmWorkDiary = function (token,diaryContent,success) {
    request.post({url:server.domain+"/attendance/confirmWorkDiary?"+server.getSignParams(),
        headers: {"Content-Type": 'application/json'},body:JSON.stringify({token:token,diaryContent:diaryContent})}, function(err, response, body) {
        if(err) { console.log(err); return; }
        success(response,JSON.parse(body))
    });
}
var confirmAttendance = function ( token, callback) {
    confirmAttendanceSever({
        token: token,
        punchCard: {
            // punchCardId: punchCardId || null,
            punchCardType: 'scan',
            workplaceType: 'workplace_BM',
            attendanceCode: 'BM003',
            provinceName: '广东',
            cityName: '广州',
            countyName: '黄埔区',
            address: '云埔一路14号',
            longitude: 113.542267+Number(Math.random(100).toFixed(2)),
            latitude: 23.151166+Number(Math.random(100).toFixed(2)),
            altitude: 10.00
        },
        workTask: 'normal_work'
    }, callback)
}
//添加上班定时任务
var startTask = function (userId,time) {
    var dayOfWeek=[];
    if(time){
        time=time.split(',');
        for(var i=0;i<time.length;i++){
            dayOfWeek.push(parseInt(time[i]));
        }
    }else{
        return
    }
    var startRule = new schedule.RecurrenceRule();
    startRule.dayOfWeek = dayOfWeek;
    startRule.hour = 8;
    startRule.minute = 10;//随机生成1-25的数字
    // startRule.minute = 17;//随机生成1-25的数字
    schedule.scheduleJob(userId,startRule, function () {
        console.log('执行startTask')
        setTimeout(function(){
            goToWork(userId)
        },Math.round(Math.random(10)*10)*60*1000)
    });
    
}

//设置下班定时任务
var finishTask = function (userId,time) {
    var dayOfWeek=[];
    if(time){
        time=time.split(',');
        for(var i=0;i<time.length;i++){
            dayOfWeek.push(parseInt(time[i]));
        }
    }else{
        return
    }
    var finishRule = new schedule.RecurrenceRule();
    finishRule.dayOfWeek = dayOfWeek;
    finishRule.hour = 17;
    finishRule.minute = 45;
    // finishRule.minute = 18;
    schedule.scheduleJob(userId,finishRule, function () {
        console.log('执行finishTask')
        // outToWork(userId)
        setTimeout(function(){
            outToWork(userId)
        },Math.round(Math.random(10)*10)*60*1000)
    });

}
var goToWorkServer=function(userId,token){
    confirmAttendance(token, function (res, data) {
        email.sendInWorkEmail(userId)
        console.log("打上班卡成功");console.log(data)
        //token失效,重新获取再打卡
        if (data.responseCode == 2301) {
            userApi.refreshToken(userId, function (token) {
                console.log("刷新TOKEN"+token)
                confirmAttendance(token, function (res, data) {
                    console.log("重新获取TOKEN,打上班卡成功");console.log(data);
                    email.sendInWorkEmail(userId)
                }
                );
            })
        }
    })
}
//上班打卡
var goToWork = function (userId) {
    userApi.getUserById(userId, function (user) {
        if(user.token){
            goToWorkServer(userId,user.token)
        }else{
            userApi.refreshToken(userId,function (token) {
                goToWorkServer(userId,token)
            })
        }

    })
}

var outToWorkServer=function(userId,token){
    getPunchCard({token: token}, function (res, data) {
        if(data.responseCode==2301){
            userApi.refreshToken(userId,function(token){
                //设置日志
                confirmWorkDiary(token,"无",function(res,data){
                    //打卡
                    confirmAttendance(token ,function (res, data) {email.sendOutWorkEmail(userId);console.log("打下班卡成功");console.log(data)
                    });
                })
            })
        }else{
            //设置日志
            confirmWorkDiary(token,"无",function(res,data){
                //打卡
                confirmAttendance(token ,function (res, data) {email.sendOutWorkEmail(userId);console.log("打下班卡成功");console.log(data)
                });
            })
        }
    })

}
//下班打卡
var outToWork=function (userId) {
    userApi.getUserById(userId, function (user) {
        //查看用户打卡Id
        if(user.token){
            outToWorkServer(userId,user.token)
        }else{
            userApi.refreshToken(userId,function (token) {
                outToWorkServer(userId,token)
            })
        }

    })
}



module.exports={
    getPunchCard:getPunchCard,
    isPunchCard:isPunchCard,
    checkScanCode:checkScanCode,
    confirmAttendanceSever:confirmAttendanceSever,
    getPunchCardList:getPunchCardList,
    confirmWorkDiary:confirmWorkDiary,
    startTask:startTask,
    finishTask:finishTask
}