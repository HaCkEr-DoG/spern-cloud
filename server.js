const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.log('MongoDB connection error:', err));

app.use('/api/emergency', require('./routes/emergency'));
app.use('/api/responder', require('./routes/responder'));

app.get('/', (req, res) => {
  res.json({ status: 'SPERN Cloud is running' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`SPERN server running on port ${PORT}`);
});