if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const mongoString = process.env.DATABASE_URL;
const routes = require('./routes/routes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Optional for form data
app.use('/api', routes);

mongoose.connect(mongoString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    tls: true, // Required for MongoDB Atlas on Heroku
    serverSelectionTimeoutMS: 5000, // Optional, adjust for connection timeout
})
    .then(() => console.log('Database Connected'))
    .catch(error => console.error('Database Connection Error:', error));

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
    console.log(`Server Started on Port ${port}`);
});


