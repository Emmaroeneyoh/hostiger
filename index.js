const express = require('express');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

const app = express();
const PORT = 7000;

function fetchEmails(callback) {
  const imap = new Imap({
    user: 'admintester@itsolb.net',
    password: 'AnuPasswor0d##',
    host: 'imap.hostinger.com',
    port: 993,
    tls: true,
  });

  function openInbox(cb) {
    imap.openBox('INBOX', true, cb);
  }

  imap.once('ready', function () {
    openInbox(function (err, box) {
      if (err) return callback(err);

      imap.search(['ALL'], function (err, results) {
        if (err) return callback(err);
        if (!results.length) {
          imap.end();
          return callback(null, []);
        }

        const f = imap.fetch(results.slice(-5), { bodies: [''] });
        const emails = [];

        f.on('message', function (msg) {
          msg.on('body', function (stream) {
            simpleParser(stream, async (err, parsed) => {
              if (!err) {
                emails.push({
                  subject: parsed.subject?.trim() || "(No Subject)",
                  from: parsed.from?.text?.trim() || "(No Sender)",
                  date: parsed.date?.toLocaleString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  }) || "(No Date)",
                  text: parsed.text?.trim().split('\n')[0] || "(No Content)",
                });
              }
            });
          });
        });

        f.once('error', function (err) {
          callback(err);
        });

        f.once('end', function () {
          imap.end();
          setTimeout(() => callback(null, emails), 1000); // small delay to allow parsing to finish
        });
      });
    });
  });

  imap.once('error', function (err) {
    callback(err);
  });

  imap.connect();
}

// Route to display emails in HTML
app.get('/emails', (req, res) => {
  fetchEmails((err, emails) => {
    if (err) return res.send(`<h2>Error fetching emails:</h2><pre>${err.message}</pre>`);

    let html = `
      <h2>Inbox</h2>
      <table border="1" cellpadding="10" cellspacing="0">
        <thead>
          <tr>
            <th>From</th>
            <th>Subject</th>
            <th>Date</th>
            <th>Text</th>
          </tr>
        </thead>
        <tbody>`;

    emails.forEach(email => {
      html += `
        <tr>
          <td>${email.from}</td>
          <td>${email.subject}</td>
          <td>${email.date}</td>
          <td>${email.text}</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    res.send(html);
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/emails`);
});
