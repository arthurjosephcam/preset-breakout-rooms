require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

let accessToken = '';

app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'test.html'));
});

app.get('/breakoutRooms', (req, res) => {
    res.sendFile(path.join(__dirname, 'breakoutRooms.html'));
});

app.get('/oauth/initiate', (req, res) => {
    const oauthURL = `https://zoom.us/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    res.redirect(oauthURL);
});

app.get('/oauth/callback', async (req, res) => {
    const authorizationCode = req.query.code;

    try {
        const response = await axios.post('https://zoom.us/oauth/token', null, {
            params: {
                grant_type: 'authorization_code',
                code: authorizationCode,
                redirect_uri: REDIRECT_URI
            },
            headers: {
                Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        accessToken = response.data.access_token;
        res.redirect('/breakoutRooms'); // Redirect to breakoutRooms page after successful authentication
    } catch (error) {
        console.error('Error fetching access token:', error);
        res.status(500).send('Error during OAuth process.');
    }
});

app.get('/verify-token', async (req, res) => {
    try {
        const response = await axios.get('https://api.zoom.us/v2/users/me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Error verifying access token:', error);
        res.status(500).json({ success: false, error: 'Error verifying access token' });
    }
});

app.post('/createBreakoutRooms', async (req, res) => {
    const { meetingId, breakoutRooms } = req.body;

    try {
        const response = await axios({
            method: 'patch',
            url: `https://api.zoom.us/v2/meetings/${meetingId}/batch`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            data: {
                requests: breakoutRooms.map(room => ({
                    method: 'post',
                    path: `/meetings/${meetingId}/breakout_rooms`,
                    body: {
                        name: room.name,
                        participants: room.participants
                    }
                }))
            }
        });

        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Error creating breakout rooms:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: error.response ? error.response.data : error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
