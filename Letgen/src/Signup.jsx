import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from 'axios';
import Tesseract from 'tesseract.js';
import 'bulma/css/bulma.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import regBackground from './assets/reg_background.jpg';

function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [collegeMailId, setCollegeMailId] = useState('');
  const [professionRole, setProfessionRole] = useState([]);
  const [deptAndSection, setDeptAndSection] = useState('');
  const [department, setDepartment] = useState('');
  const [isHosteller, setIsHosteller] = useState('');
  const [hostelName, setHostelName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [image, setImage] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [googleScriptError, setGoogleScriptError] = useState('');

  const validateEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const validateCollegeEmailId = (email) => {
    const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    return re.test(email) && email.endsWith('mepcoeng.ac.in');
  };

  const validatePassword = (password) => {
    return password.length >= 6;
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      setExtractedText('');
      setRegistrationError('');
    } else if (file) {
      setImage(null);
      setExtractedText('');
      setRegistrationError('Please upload a valid image file.');
    } else {
      setImage(null);
      setExtractedText('');
    }
  };

  const performOcr = async () => {
    if (!image) {
      setRegistrationError('Please upload an ID card image.');
      return null;
    }

    setLoadingOcr(true);
    try {
      const { data: { text } } = await Tesseract.recognize(
        image,
        'eng',
        { logger: (m) => console.log(m) }
      );
      setExtractedText(text);
      return text;
    } catch (error) {
      console.error('Error during OCR:', error);
      setRegistrationError('Error during image text extraction.');
      return null;
    } finally {
      setLoadingOcr(false);
    }
  };

  const handleRoleChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setProfessionRole([...professionRole, value]);
    } else {
      setProfessionRole(professionRole.filter(role => role !== value));
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setRegistrationError('');
    setRegistrationSuccess(false);

    if (!name.trim()) {
      setRegistrationError('Name is required.');
      return;
    }
    if (!email.trim()) {
      setRegistrationError('Personal Email ID is required.');
      return;
    }
    if (!validateEmail(email)) {
      setRegistrationError('Invalid Personal Email ID format.');
      return;
    }
    if (!collegeMailId.trim()) {
      setRegistrationError('College Mail ID is required.');
      return;
    }
    if (!validateCollegeEmailId(collegeMailId)) {
      setRegistrationError('Invalid College Mail ID format. Use mepcoeng.ac.in domain.');
      return;
    }
    if (!password) {
      setRegistrationError('Password is required.');
      return;
    }
    if (!validatePassword(password)) {
      setRegistrationError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setRegistrationError('Passwords do not match.');
      return;
    }
    if (professionRole.length === 0) {
      setRegistrationError('Select at least one Profession Role.');
      return;
    }
    if (professionRole.includes('staff advisor') && !deptAndSection.trim()) {
      setRegistrationError('Department, Section, and Year required for Staff Advisors.');
      return;
    }
    if ((professionRole.includes('sub warden') || (professionRole.includes('student') && isHosteller === 'yes')) && !hostelName.trim()) {
      setRegistrationError('Hostel Name required for Sub Wardens and Hosteller Students.');
      return;
    }
    if ((professionRole.includes('hod') || professionRole.includes('staff advisor') || professionRole.includes('student')) && !department.trim()) {
      setRegistrationError('Department required for the selected role(s).');
      return;
    }
    if (professionRole.includes('student') && !rollNumber.trim()) {
      setRegistrationError('Roll Number required for Students.');
      return;
    }
    if (professionRole.includes('student') && !isHosteller) {
      setRegistrationError('Indicate if you are a hosteller.');
      return;
    }
    if (!image) {
      setRegistrationError('Upload your ID card.');
      return;
    }

    const ocrResult = await performOcr();
    if (ocrResult === null) {
      return;
    }

    if (!ocrResult.includes('')) {
      setRegistrationError('Invalid Mepco Schlenk Engineering College ID card.');
      return;
    }

    const userData = {
      name,
      email,
      password,
      collegeMailId,
      professionRole,
      deptAndSection,
      department,
      isHosteller,
      hostelName,
      rollNumber,
      ocrText: extractedText,
      imageFile: image ? image.name : null,
    };

    try {
      const response = await axios.post('http://localhost:3008/register', userData);
      console.log('Manual registration response:', response.data);
      setRegistrationSuccess(true);
    } catch (error) {
      console.error('Manual registration error:', error.response ? error.response.data : error.message);
      setRegistrationError(error.response ? error.response.data.message || 'Registration failed.' : 'Registration failed due to a network error.');
    }
  };

  const handleGoogleSignIn = async (googleData) => {
    setRegistrationError('');
    setRegistrationSuccess(false);

    try {
      const response = await axios.post('http://localhost:3008/register/google', {
        token: googleData.credential,
      });
      console.log('Google registration response:', response.data);
      setRegistrationSuccess(true);
    } catch (error) {
      console.error('Google registration error:', error.response ? error.response.data : error.message);
      setRegistrationError(error.response ? error.response.data.message || 'Google registration failed.' : 'Google registration failed due to a network error.');
    }
  };

  // Load Google Sign-In script and initialize
  useEffect(() => {
    const loadGoogleScript = () => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google && window.google.accounts) {
          window.google.accounts.id.initialize({
            client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // Replace with your Google Client ID
            callback: handleGoogleSignIn,
          });
          window.google.accounts.id.renderButton(
            document.getElementById('googleSignInButton'),
            {
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              width: '300',
            }
          );
        } else {
          setGoogleScriptError('Failed to initialize Google Sign-In. Please try again later.');
        }
      };
      script.onerror = () => {
        setGoogleScriptError('Failed to load Google Sign-In script. Check your internet connection.');
      };
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    };

    loadGoogleScript();
  }, []);

  return (
    <section className="hero is-fullheight" style={{
      backgroundImage: `url(${regBackground})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <div className="hero-body">
        <div className="container">
          <div className="columns is-centered">
            <div className="column is-half">
              <form onSubmit={handleManualSubmit} className="box">
                <h2 className="title has-text-centered" style={{ color: '#002f6c' }}>Register</h2>
                {registrationError && (
                  <div className="notification is-danger">{registrationError}</div>
                )}
                {googleScriptError && (
                  <div className="notification is-warning">{googleScriptError}</div>
                )}
                {registrationSuccess && (
                  <div className="notification is-success">
                    Registration successful! You can now <Link to="/login">login</Link>.
                  </div>
                )}
                <div className="field">
                  <label className="label" style={{ color: '#002f6c' }}>Name</label>
                  <div className="control">
                    <input
                      className="input"
                      type="text"
                      id="name"
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your Name"
                      required
                      style={{ backgroundColor: 'transparent', color: '#363636' }}
                    />
                  </div>
                </div>
                <div className="field">
                  <label className="label" style={{ color: '#002f6c' }}>Personal Email ID</label>
                  <div className="control">
                    <input
                      className="input"
                      type="email"
                      id="email"
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your Email"
                      required
                      style={{ backgroundColor: 'transparent', color: '#363636' }}
                    />
                  </div>
                </div>
                <div className="field">
                  <label className="label" style={{ color: '#002f6c' }}>College Mail ID</label>
                  <div className="control">
                    <input
                      className="input"
                      type="email"
                      id="collegeMailId"
                      onChange={(e) => setCollegeMailId(e.target.value)}
                      placeholder="College Email ID"
                      required
                      style={{ backgroundColor: 'transparent', color: '#363636' }}
                    />
                  </div>
                </div>
                <div className="field">
                  <label className="label" style={{ color: '#002f6c' }}>Password</label>
                  <div className="control">
                    <input
                      className="input"
                      type="password"
                      id="password"
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your Password"
                      required
                      style={{ backgroundColor: 'transparent', color: '#363636' }}
                    />
                  </div>
                </div>
                <div className="field">
                  <label className="label" style={{ color: '#002f6c' }}>Confirm Password</label>
                  <div className="control">
                    <input
                      className="input"
                      type="password"
                      id="confirmPassword"
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm Your Password"
                      required
                      style={{ backgroundColor: 'transparent', color: '#363636' }}
                    />
                  </div>
                </div>
                <div className="field">
                  <label className="label" style={{ color: '#002f6c' }}>Profession Role</label>
                  <div className="control" style={{ paddingLeft: '1em' }}>
                    {['Principal', 'Staff Advisor', 'HOD', 'Deputy Warden', 'Sub Warden', 'Student'].map(role => (
                      <div key={role} style={{ marginBottom: '0.5em' }}>
                        <label
                          className="checkbox"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: '#002f6c'
                          }}
                        >
                          <input
                            type="checkbox"
                            id={role.toLowerCase().replace(/ /g, '_')}
                            value={role.toLowerCase()}
                            onChange={handleRoleChange}
                            style={{ marginRight: '0.5em' }}
                          />
                          {role}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                {professionRole.includes('staff advisor') && (
                  <div className="field">
                    <label className="label" style={{ color: '#002f6c' }}>Department and Section and Year</label>
                    <div className="control">
                      <input
                        className="input"
                        type="text"
                        id="deptAndSection"
                        onChange={(e) => setDeptAndSection(e.target.value)}
                        placeholder="e.g., CSE-A 2nd Year"
                        style={{ backgroundColor: 'transparent', color: '#363636' }}
                        required
                      />
                    </div>
                  </div>
                )}
                {(professionRole.includes('sub warden')) && (
                  <div className="field">
                    <label className="label" style={{ color: '#002f6c' }}>Hostel Name</label>
                    <div className="control">
                      <input
                        className="input"
                        type="text"
                        id="hostelName"
                        onChange={(e) => setHostelName(e.target.value)}
                        placeholder="e.g., Tagore Hostel"
                        style={{ backgroundColor: 'transparent', color: '#363636' }}
                        required
                      />
                    </div>
                  </div>
                )}
                {(professionRole.includes('hod') || professionRole.includes('staff advisor') || professionRole.includes('student')) && (
                  <div className="field">
                    <label className="label" style={{ color: '#002f6c' }}>Department</label>
                    <div className="control">
                      <input
                        className="input"
                        type="text"
                        id="department"
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g., Computer Science and Engineering"
                        style={{ backgroundColor: 'transparent', color: '#363636' }}
                        required
                      />
                    </div>
                  </div>
                )}
                {professionRole.includes('student') && (
                  <>
                    <div className="field">
                      <label className="label" style={{ color: '#002f6c' }}>Roll Number</label>
                      <div className="control">
                        <input
                          className="input"
                          type="text"
                          id="rollNumber"
                          onChange={(e) => setRollNumber(e.target.value)}
                          placeholder="Your Roll Number"
                          style={{ backgroundColor: 'transparent', color: '#363636' }}
                          required
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label className="label" style={{ color: '#002f6c' }}>Are you a Hosteller?</label>
                      <div className="control">
                        <label className="radio" style={{ color: '#002f6c', marginRight: '1em' }}>
                          <input type="radio" name="isHosteller" value="yes" onChange={() => setIsHosteller('yes')} required={professionRole.includes('student')} />
                          Yes
                        </label>
                        <label className="radio" style={{ color: '#002f6c' }}>
                          <input type="radio" name="isHosteller" value="no" onChange={() => setIsHosteller('no')} required={professionRole.includes('student')} />
                          No
                        </label>
                      </div>
                    </div>
                    {isHosteller === 'yes' && (
                      <div className="field">
                        <label className="label" style={{ color: '#002f6c' }}>Hostel Name</label>
                        <div className="control">
                          <input
                            className="input"
                            type="text"
                            id="hostelName"
                            onChange={(e) => setHostelName(e.target.value)}
                            placeholder="e.g., Tagore Hostel"
                            style={{ backgroundColor: 'transparent', color: '#363636' }}
                            required
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="field" style={{ display: 'flex', alignItems: 'center' }}>
                  <label className="label" style={{ color: '#002f6c', marginRight: '1em' }}>Upload ID card</label>
                  <div className="control">
                    <div className="file is-info">
                      <label className="file-label">
                        <input
                          className="file-input"
                          type="file"
                          name="image"
                          accept="image/*"
                          onChange={handleImageChange}
                          required
                        />
                        <span className="file-cta">
                          <span className="file-icon">
                            <i className="fas fa-upload"></i>
                          </span>
                          <span className="file-label">
                            Choose an image…
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
                {loadingOcr && <div className="control"><button className="button is-info is-loading">Processing OCR...</button></div>}
                {extractedText && (
                  <div className="box" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', color: '#363636' }}>
                    <h4 className="subtitle is-6">Extracted Text:</h4>
                    <pre style={{ color: '#363636' }}>{extractedText}</pre>
                  </div>
                )}
                <div className="field">
                  <div className="control">
                    <button type="submit" className={`button is-primary ${loadingOcr ? 'is-loading' : ''}`} disabled={loadingOcr}>
                      Register
                    </button>
                  </div>
                </div>
                <div className="field">
                  <div className="control has-text-centered">
                    <div id="googleSignInButton" style={{ display: 'inline-block', marginTop: '1rem' }}></div>
                  </div>
                </div>
                <div className="control has-text-centered" style={{ color: '#002f6c', fontSize: '14px', marginTop: '1rem' }}>
                  Already have an account? <Link to="/login">Login</Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Signup;