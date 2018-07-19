const request = require('request');
const { RTMClient, WebClient } = require('@slack/client');
const http = require('http');

const token = process.env.BOT_TOKEN;
const rtm = new RTMClient(token);
const web = new WebClient(token);

rtm.start();

const Listeners = {};
// 'http://dest' : {channel: null, pattern: null}

function skip(message){
  // From bot
  if (message.subtype && message.subtype === 'bot_message') return true;
  // juse mentioning there was a reply in a thread
  if (message.subtype && message.subtype === 'message_replied') return true;
  // From me
  if (!message.subtype && message.user === rtm.activeUserId) return true;
}

rtm.on('message', (message) => {
  console.debug('Received message', message);

  if (skip(message)) return

  var direct = new RegExp(`^<@${rtm.activeUserId}>`);

  // loop through all our listeners
  Object.keys(Listeners).forEach((id) => {
    var listener = Listeners[id];
    var isDirect = (message.text.match(direct) !== null);
    if (
      (listener.direct === isDirect) &&
      (!listener.channel || listener.channel === message.channel) &&
      (!listener.filter || message.text.match(listener.filter) !== null)
    ){
      // [TODO] add metric for receiving this event
      console.log('Publishing to '+listener.id);
      request.post({
        headers: {'Content-Type': 'application/json'},
        url: listener.endpoint || process.env.OMG_ENDPOINT,
        body: JSON.stringify({
          id: listener.id,
          event: ((isDirect) ? 'responds' : 'hears'),
          data: message,
        })
      });
    }
  });
});

// web server to acccept new listeners from platform
http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    var data = JSON.parse(body);
    if (req.url == '/subscribe') {
      // [TODO] log new listener
      console.log('New subscribe '+body);

      Listeners[data.id] = {
          direct: (data.event === 'responds'),
          endpoint: data.endpoint,
          channel: data.data.channel,
          pattern: (data.data.pattern ? new RegExp(data.data.pattern) : null),
      };
      res.writeHead(204, {'Content-type':'text/plan'});
      res.end();

    } else if (req.url == '/unsubscribe') {
      // [TODO] log new listener
      console.log('New unsubscribe')

      delete Listeners[data.id];
      res.writeHead(204, {'Content-type':'text/plan'});
      res.end();

    } else if (req.url == '/send') {
      // Send a message
      web.chat.postMessage(data)
        .then((res) => {
          console.log('Message sent: ', res.ts);
          res.writeHead(204, {'Content-type':'text/plan'});
          res.end();
        })
        .catch((err) => {
          console.error(err);
          res.writeHead(500, {'Content-type':'text/plan'});
          res.end(err);
        });

    } else {
      // [TODO] log new listener
      console.error('Bad request')

      res.writeHead(400, {'Content-type':'text/plan'});
      res.end('Bad request');
    }
  });
}).listen(process.env.PUBSUB_PORT || 5000);