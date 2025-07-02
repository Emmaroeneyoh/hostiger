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

        const f = imap.fetch(results.slice(-10), { bodies: [''] }); // fetch last 10
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
                  text: parsed.text?.trim() || "(No Plain Text)",
                  html: parsed.html?.trim() || null,
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
          setTimeout(() => callback(null, emails), 1000);
        });
      });
    });
  });

  imap.once('error', function (err) {
    callback(err);
  });

  imap.connect();
}

// Route to display emails
app.get('/emails', (req, res) => {
  fetchEmails((err, emails) => {
    if (err) return res.send(`<h2>Error fetching emails:</h2><pre>${err.message}</pre>`);

    let html = `
    <html>
    <head>
      <title>Email Inbox</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f7f9fc;
        }
        h2 {
          text-align: center;
          color: #333;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          padding: 12px 15px;
          border: 1px solid #ddd;
          text-align: left;
        }
        th {
          background-color: #007bff;
          color: white;
        }
        tr:hover {
          background-color: #f1f1f1;
          cursor: pointer;
        }
        .modal {
          display: none;
          position: fixed;
          z-index: 999;
          left: 0; top: 0;
          width: 100%; height: 100%;
          overflow: auto;
          background-color: rgba(0,0,0,0.5);
        }
        .modal-content {
          background-color: white;
          margin: 10% auto;
          padding: 20px;
          border-radius: 8px;
          width: 80%;
          max-height: 80%;
          overflow-y: auto;
        }
        .close {
          float: right;
          font-size: 24px;
          font-weight: bold;
          color: #aaa;
        }
        .close:hover {
          color: #000;
        }
        @media (max-width: 768px) {
          .modal-content {
            width: 95%;
          }
        }
      </style>
    </head>
    <body>
      <h2>Inbox</h2>
      <table>
        <thead>
          <tr>
            <th>From</th>
            <th>Subject</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>`;

    emails.forEach((email, index) => {
      html += `
        <tr onclick="openModal(${index})">
          <td>${email.from}</td>
          <td>${email.subject}</td>
          <td>${email.date}</td>
        </tr>`;
    });

    html += `
        </tbody>
      </table>

      <div id="emailModal" class="modal">
        <div class="modal-content">
          <span class="close" onclick="closeModal()">&times;</span>
          <div id="emailContent"></div>
        </div>
      </div>

      <script>
        const emails = ${JSON.stringify(emails)};

        function openModal(index) {
          const content = emails[index].html || '<pre>' + emails[index].text + '</pre>';
          document.getElementById('emailContent').innerHTML = content;
          document.getElementById('emailModal').style.display = 'block';
        }

        function closeModal() {
          document.getElementById('emailModal').style.display = 'none';
        }

        window.onclick = function(event) {
          const modal = document.getElementById('emailModal');
          if (event.target == modal) closeModal();
        }
      </script>
    </body>
    </html>
    `;

    res.send(html);
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/emails`);
});
