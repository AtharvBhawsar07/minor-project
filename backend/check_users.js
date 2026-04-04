const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

const checkUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
    const users = await User.find({}).select('email name role studentId');
    console.log('Total users found:', users.length);
    users.forEach(u => console.log(`- ${u.name} (${u.email}) | ID: ${u.studentId} | Role: ${u.role}`));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkUsers();
