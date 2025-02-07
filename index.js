const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const Payment = require('./models/Payment');

app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const mongoUri = process.env.MONGODB_URI;
const sessionSecret = process.env.SESSION_SECRET;


// Session configuration
app.use(
    session({
        secret: 'your_secret_key', // Replace with a secure key
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }, // Set to true if using HTTPS
    })
);
// Delete payment route
app.delete('/payments/:id', async (req, res) => {
    try {
        const payment = await Payment.findByIdAndDelete(req.params.id);
        
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        res.json({ message: 'Payment deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// MongoDB Schema
const applicantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    age: { type: Number, required: true, min: 0 },
    address: { type: String },
    postcode: { type: String, required: true },
    phone: { type: String, required: true },
    faculty: { type: String, required: true },
    hometown: { type: String, required: true },
});

const Applicant = mongoose.model('Applicant', applicantSchema);
app.get('/test-payment', async (req, res) => {
    try {
      const testPayment = new Payment({
        company_name: "Test Company",
        reference: "TEST-123"
      });
      await testPayment.save();
      res.send('Payment model works!');
    } catch (err) {
      res.status(500).send(err.message);
    }
  });
  // Payment routes
app.get("/payments", async (req, res) => {
    try {
      const payments = await Payment.find().sort({ timestamp: -1 });
      res.render("payments", { payments });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
  });

  
  app.post("/payments", async (req, res) => {
    try {
      const { company_name } = req.body;
      
      if (!company_name) {
        return res.status(400).json({ error: "Company name is required" });
      }
  
      const reference = `SPONSOR-${company_name.toUpperCase().replace(/\s+/g, '-')}`;
      const payment = new Payment({ company_name, reference });
  
      await payment.save();
      res.status(201).json({ 
        message: "Payment recorded successfully!", 
        payment: {
          ...payment._doc,
          timestamp: payment.timestamp.toLocaleString()
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server Error" });
    }
  });

// Routes
app.get('/signup', (req, res) => {
    res.render('signup',); // Render 'signup.ejs' page
});

app.post('/api/applicant', async (req, res) => {
    try {
        const { name, email, password, age, address, postcode, phone, faculty, hometown } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newApplicant = new Applicant({
            name,
            email,
            password: hashedPassword,
            age,
            address,
            postcode,
            phone,
            faculty,
            hometown,
        });

        await newApplicant.save();

        res.status(200).json({
            success: true,
            message: 'Sign up successful. You can now log in.',
        });
    } catch (error) {
        console.error('Error during sign up:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.',
        });
    }
});

// Login GET
app.get('/login', (req, res) => {
    const message = req.query.message || ''; // Retrieve any error message
    res.render('login', { message });
});
// GET Route - Forgot Password Page
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { 
        error: null,
        message: null,
        isLoggedIn: false 
    });
});

// POST Route - Password Reset
app.post('/forgot-password', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        
        if (!user) {
            return res.render('forgot-password', { 
                error: 'Email not found',
                message: null,
                isLoggedIn: false 
            });
        }

        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Update user's password
        await User.updateOne(
            { email: req.body.email },
            { $set: { password: hashedPassword } }
        );

        // Send email with password reset instructions
        // (You'll need to implement your email service here)
        /*
        await sendPasswordResetEmail({
            email: user.email,
            tempPassword: tempPassword
        });
        */

        res.render('forgot-password', { 
            error: null,
            message: 'Password reset instructions sent to your email',
            isLoggedIn: false 
        });

    } catch (error) {
        console.error('Password reset error:', error);
        res.render('forgot-password', { 
            error: 'Error processing your request. Please try again.',
            message: null,
            isLoggedIn: false 
        });
    }
});


// Login POST
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await Applicant.findOne({ email });
        if (user && (await bcrypt.compare(password, user.password))) {
            // Save user data to session
            req.session.user = {
                id: user._id,
                name: user.name,
                email: user.email,
            };
            return res.redirect('/dashboard');
        } else {
            return res.redirect('/login?message=Invalid email or password');
        }
    } catch (error) {
        console.error('Error during login:', error);
        return res.redirect('/login?message=An error occurred');
    }
});


// Dashboard
app.get('/dashboard', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const user = await Applicant.findById(req.session.user.id); // Get user info from session
        if (!user) {
            return res.status(404).send('User not found');
        }

        res.render('dashboard', {
            message: `Welcome back, ${req.session.user.name}!`,
            user, // Pass user data to the dashboard
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).send('An error occurred while loading the dashboard.');
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during logout:', err);
            return res.status(500).send('Error during logout');
        }
        res.redirect('/login');
    });
});

// Static pages
app.get('/about-us', (req, res) => {
    res.render('about-us', { user: req.session.user }); // Pass user data to the template
});

app.get('/contact-us', (req, res) => {
    res.render('contact-us', { user: req.session.user }); // Pass user data to the template
});

// Route to get the user profile
app.get('/user-profile', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login',{ user: req.session.user }); // Redirect to login if user is not logged in
    }

    try {
        const user = await Applicant.findById(req.session.user.id); // Fetch user data
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Render the user profile page and pass user data to it
        res.render('user-profile', { user },{ user: req.session.user });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).send('An error occurred while loading the profile.');
    }
},);
app.post('/submit-quiz', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const { hobbies, personality, year } = req.body;
    try {
        const response = new QuizResponse({
            userId: req.session.user.id,
            hobbies,
            personality,
            year,
        });
        await response.save();
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error saving quiz response:', error);
        res.status(500).send('An error occurred while submitting the quiz.');
    }
});
const quizResponseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true },
    hobbies: [String],
    personality: { type: String, required: true },
    year: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
});
app.get('/quiz', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('quiz');
});
app.post('/submit-quiz', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const { hobbies, personality, year } = req.body;

    try {
        const response = new QuizResponse({
            userId: req.session.user.id,
            hobbies: Array.isArray(hobbies) ? hobbies : [hobbies], // Handle single or multiple selections
            personality,
            year,
        });

        await response.save();

        res.redirect('/dashboard'); // Redirect after successful submission
    } catch (error) {
        console.error('Error saving quiz response:', error);
        res.status(500).send('An error occurred while submitting the quiz.');
    }
});
app.get('/quiz-responses', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const responses = await QuizResponse.find({ userId: req.session.user.id });
        res.render('quiz-responses', { responses });
    } catch (error) {
        console.error('Error fetching quiz responses:', error);
        res.status(500).send('An error occurred while loading quiz responses.');
    }
});
  // Serve static files from the 'public' folder

const QuizResponse = mongoose.model('QuizResponse', quizResponseSchema);

app.get('/api/exercises', (req, res) => {
    const exercises = [
      { name: 'Deep Breathing', time: 120 },
      { name: 'Box Breathing', time: 120 },
      { name: '4-7-8 Breathing', time: 120 },
    ];
    res.json(exercises);
  });
  
  
  app.get('/api/exercises', (req, res) => {
    const exercises = [
      { name: 'Deep Breathing', time: 120 },
      { name: 'Box Breathing', time: 120 },
      { name: '4-7-8 Breathing', time: 120 },
    ];
    res.json(exercises);
  });
  
  // Render the activities page using EJS
  app.get('/activities', (req, res) => {
    const exercises = [
      { name: 'Deep Breathing', time: 120 },
      { name: 'Box Breathing', time: 120 },
      { name: '4-7-8 Breathing', time: 120 },
    ];
    res.render('activities', { exercises },{ user: req.session.user });
  });
  const journalSchema = new mongoose.Schema({
    thought: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});
app.get('/resources', (req, res) => {
    res.render('resources');
  });
const Journal = mongoose.model('Journal', journalSchema);
  app.get('/journal', async (req, res) => {
    const prompt = "What made you smile today?";
    try {
        const journals = await Journal.find().sort({ createdAt: -1 }); 
        res.render('journal', { prompt, journals });
    } catch (error) {
        console.error('Error fetching journals:', error);
        res.status(500).send('An error occurred while loading the journal page.');
    }
});
app.get('/', (req, res) => {
    res.render('home',{ user: req.session.user });
});

app.post('/submit-journal', async (req, res) => {
    const { thought } = req.body;
    try {
        const journalEntry = new Journal({ thought });
        await journalEntry.save();
        res.redirect('/journal?success=true',{ user: req.session.user });
    } catch (error) {
        console.error('Error saving journal entry:', error);
        res.redirect('/journal?error=true',{ user: req.session.user });
    }
});

app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { user: req.session.user }); // Pass user data to the template
});

app.post('/forgot-password', async (req, res) => {
    try {
      const { email, adminPassword, newPassword } = req.body;
      
      // Verify admin password
      if (adminPassword !== process.env.ADMIN_RESET_PASSWORD) {
        return res.status(403).json({ error: 'Invalid admin credentials' });
    }
      // Find user by email
      const user = await Applicant.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();
  
      res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  app.post('/create-sponsor-session', async (req, res) => {
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'zar',
            product_data: {
              name: 'Mental Health Xcellerators Sponsorship',
            },
            unit_amount: 500000, // R5000.00 (amount in cents)
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.DOMAIN}/success.html`,
        cancel_url: `${process.env.DOMAIN}/cancel.html`,
      });
  
      res.json({ id: session.id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
mongoose
    .connect('mongodb+srv://smetchappy:Egd8lV7C8J5mcymM@backeddb.pmksk.mongodb.net/MentalHealth?retryWrites=true&w=majority&appName=BackedDB', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('Connected to the database');

        app.listen(3000, () => {
            console.log('The server is running at port 3000');
        });
    })
    .catch((error) => {
        console.log('Failed to connect to the database', error);
    })



    
