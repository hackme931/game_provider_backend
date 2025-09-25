require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ PERBAIKAN 1: Validasi API Key untuk internal game provider calls
const validateGameProviderApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.GAME_PROVIDER_API_KEY) {
    return res.status(401).json({ 
      message: 'Invalid or missing API Key' 
    });
  }
  
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Game Provider Backend is running',
    timestamp: new Date().toISOString()
  });
});

// ✅ ENDPOINT 1: Authenticate Game Session
app.post('/authenticate', validateGameProviderApiKey, async (req, res) => {
  try {
    const { playerToken } = req.body;

    if (!playerToken) {
      return res.status(400).json({ message: 'playerToken is required' });
    }

    // Decode JWT token
    const decoded = jwt.verify(playerToken, '123');
    const userId = decoded.user.id;

    // Fetch balance dari casino backend
    const balanceResponse = await fetch(`http://localhost:3000/api/wallet/balance`, {
      method: 'GET',
      headers: {
        'x-auth-token': playerToken,
        'Content-Type': 'application/json'
      }
    });

    if (!balanceResponse.ok) {
      throw new Error('Failed to fetch balance from casino');
    }

    const balanceData = await balanceResponse.json();

    res.status(200).json({
      sessionId: `gp_${Date.now()}_${userId}`,
      userId: userId,
      username: decoded.user.username,
      balance: balanceData.balance,
      currency: balanceData.currency
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: 'Invalid player token' });
    }
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ✅ ENDPOINT 2: Debit Balance (Taruhan)
app.post('/debit', validateGameProviderApiKey, async (req, res) => {
  try {
    const { sessionId, userId, roundId, amount } = req.body;

    if (!sessionId || !userId || !roundId || !amount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // ✅ PERBAIKAN 2: Gunakan API Key yang diharapkan casino backend
    const debitResponse = await fetch('http://localhost:3000/api/game/debit', {
      method: 'POST',
      headers: {
        'x-api-key': "KunciSuperRahasiaGameServer123!@#", // ✅ KEY YANG DIMINTA CASINO
        'x-session-id': sessionId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: userId,
        roundId: roundId,
        amount: amount
      })
    });

    if (!debitResponse.ok) {
      const errorData = await debitResponse.json();
      return res.status(debitResponse.status).json({
        success: false,
        message: errorData.message || 'Debit failed'
      });
    }

    const debitResult = await debitResponse.json();

    res.status(200).json({
      success: true,
      newBalance: debitResult.newBalance,
      transactionId: debitResult.transactionId
    });

  } catch (error) {
    console.error('Debit error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal Server Error' 
    });
  }
});

// ✅ ENDPOINT 3: Credit Balance (Kemenangan)
app.post('/credit', validateGameProviderApiKey, async (req, res) => {
  try {
    const { sessionId, userId, roundId, amount } = req.body;

    if (!sessionId || !userId || !roundId || !amount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // ✅ PERBAIKAN 3: Gunakan API Key yang diharapkan casino backend
    const creditResponse = await fetch('http://localhost:3000/api/game/credit', {
      method: 'POST',
      headers: {
        'x-api-key': "KunciSuperRahasiaGameServer123!@#", // ✅ KEY YANG DIMINTA CASINO
        'x-session-id': sessionId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: userId,
        roundId: roundId,
        amount: amount
      })
    });

    if (!creditResponse.ok) {
      const errorData = await creditResponse.json();
      return res.status(creditResponse.status).json({
        success: false,
        message: errorData.message || 'Credit failed'
      });
    }

    const creditResult = await creditResponse.json();

    res.status(200).json({
      success: true,
      newBalance: creditResult.newBalance,
      transactionId: creditResult.transactionId
    });

  } catch (error) {
    console.error('Credit error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal Server Error' 
    });
  }
});

// ✅ PERBAIKAN 4: Tambahkan endpoint untuk game client
app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});
// ✅ ENDPOINT 4: Get Player Info untuk Game Client
// ✅ ENDPOINT 4: Get Player Info untuk Game Client
app.post('/player-info', validateGameProviderApiKey, async (req, res) => {
  try {
    const { playerToken } = req.body;

    if (!playerToken) {
      return res.status(400).json({ message: 'playerToken is required' });
    }

    // Decode JWT token
    const decoded = jwt.verify(playerToken, '123'); // Secret dari casino backend
    const userId = decoded.user.id;

    // Fetch balance dari casino backend
    const balanceResponse = await fetch(`http://localhost:3000/api/wallet/balance`, {
      method: 'GET',
      headers: {
        'x-auth-token': playerToken,
        'Content-Type': 'application/json'
      }
    });

    if (!balanceResponse.ok) {
      throw new Error('Failed to fetch balance from casino');
    }

    const balanceData = await balanceResponse.json();

    res.status(200).json({
      success: true,
      userId: userId,
      username: decoded.user.username,
      balance: balanceData.balance,
      currency: balanceData.currency
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        success: false,
        message: 'Invalid player token' 
      });
    }
    console.error('Player info error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal Server Error' 
    });
  }
});

// ✅ ENDPOINT 5: Get RTP Settings untuk Game Client
app.get('/rtp/:gameId', validateGameProviderApiKey, async (req, res) => {
  try {
    const { gameId } = req.params;
    console.log('Fetching RTP for game:', gameId);
    
    // Fetch RTP dari casino backend
    const rtpResponse = await fetch(`http://localhost:3000/api/rtp/${gameId}`);
    
    if (!rtpResponse.ok) {
      throw new Error('Failed to fetch RTP from casino backend');
    }
    
    const rtpData = await rtpResponse.json();
    
    res.status(200).json({
      success: true,
      gameId: gameId,
      baseRtp: parseFloat(rtpData.base_rtp),
      gameName: rtpData.game_name
    });
    
  } catch (error) {
    console.error('RTP fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch RTP settings'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🎮 Game Provider Backend running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Game Provider API Key: ${process.env.GAME_PROVIDER_API_KEY}`);
  console.log(`🔑 Casino API Key: KunciSuperRahasiaGameServer123!@#`);
});