'use strict';
const line = require('@line/bot-sdk');
const express = require('express');
const configGet = require('config');
const request = require('request');

const config = {
  //channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  //channelSecret: process.env.CHANNEL_SECRET,
  //直接放在config裡面管理
  channelAccessToken: configGet.get("CHANNEL_ACCESS_TOKEN"),
  channelSecret: configGet.get("CHANNEL_SECRET")
};
const msSubscriptionKey = configGet.get("MS_SUBSCRIPTION_KEY");
// create LINE SDK client
const client = new line.Client(config);
// create Express app
const app = express();

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// listen on port
const port = process.env.PORT || 1234;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});

// event handler
function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    //return Promise.resolve(null);
    //本來是要忽略非文字的，影像辨識反而變成主力
    console.log("event type:"+event.type);
    console.log("event message type:"+event.message.type);
    console.log("event detail"+JSON.stringify(event));
    //把event送進自定義的影像辨識函數
    MSimageRecognition(event)
  }else{
    // create a echoing text message
  //const echo = { type: 'text', text: event.message.text };
  //文字訊息固定只回這句
  const echo = { type: 'text', text: "請輸入一張圖片進行影像辨識" };
  // use reply API
  return client.replyMessage(event.replyToken, echo);
  }
}

function MSimageRecognition(thisEvent){
console.log('[MSimageRecognition in]');
//thieResult用來存放最終要回應的文字
let thisResult=null;
// Replace <Subscription Key> with your valid subscription key.
const subscriptionKey = msSubscriptionKey;
//注意Key在哪一區申請，下面的網址就改成哪一區
const uriBase =
    'https://westcentralus.api.cognitive.microsoft.com/vision/v2.0/analyze';

const imageID = thisEvent.message.id;
console.log("imageID:"+imageID);

//準備微軟電腦視覺API要的參數
const params = {
  'overload':'stream',
  'visualFeatures': 'Description',
  'details': '',
  'language': 'zh'
};

const options = {
  uri: uriBase,
  qs: params,
  //因為是Binary圖檔，所以待會用 Data
  //body: '{"url": ' + '"' + imageUrl + '"}',
  headers: {
      'Content-Type': 'application/octet-stream',
      'Ocp-Apim-Subscription-Key' : subscriptionKey
  }
};

//取得圖檔
client.getMessageContent(imageID)
  .then((stream) => {
    var data = null;
    stream.on('data', (chunk) => {
      //串流組合圖檔
      if(data){
        data = Buffer.concat([data, chunk]);
      }else{
        data = chunk;        
      }
      console.log("adding...");
    });
    stream.on('error', (err) => {
      // error handling
      console.log(err);
    });
    stream.on('end', () => {
      //圖檔組合完成
      console.log('Image Done!');
      options.body=data;
      //送往微軟進行圖像識別
      request.post(options, (error, response, body) => {
        let echo=null;
        console.log('[request in]');
        if (error) {
          console.log('Error: ', error);
          return;
        }
        let jsonResponse = JSON.stringify(JSON.parse(body), null, '  ');
        console.log('JSON Response\n');
        console.log(jsonResponse);
        //確認是否有拿到一段描述
        if(JSON.parse(body).description.captions.length!=0)
        { 
          thisResult = JSON.parse(body).description.captions[0].text;
          console.log("thisResult:"+thisResult);
          echo = { type: 'text', text: thisResult};
        }else
        {
          echo = { type: 'text', text: "這張圖片太高深莫測了！"};
        }
        // use reply API
        //傳給使用者
        client.replyMessage(thisEvent.replyToken, echo);
      }); 
    });
  });
}