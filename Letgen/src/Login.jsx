import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from 'axios';
import 'bulma/css/bulma.css';
import './App.css';
import regBackground from './assets/reg_background.jpg';

function Login() {
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const response = await axios.post('http://localhost:3008/login', { collegeMailId: email, password });
      console.log('Login successful:', response.data);
      localStorage.setItem('userCollegeId', email); 
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error.response ? error.response.data : error.message);
      setLoginError(error.response ? error.response.data.message || 'Login failed. Invalid credentials.' : 'Login failed due to a network error.');
    }
  };

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
              <form onSubmit={handleSubmit} className="box">
                <h2 className="title has-text-centered" style={{ color: '#002f6c' }}>Login</h2>
                {loginError && (
                  <div className="notification is-danger">{loginError}</div>
                )}
                <div className="field">
                  <label className="label" style={{ color: '#002f6c' }}>College Email ID</label>
                  <div className="control">
                    <input
                      className="input"
                      type="email"
                      placeholder="Your College Email ID"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                      placeholder="Your Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ backgroundColor: 'transparent', color: '#363636' }}
                    />
                  </div>
                </div>

                <div className="control">
                  <button type="submit" className="button is-primary">Login</button>
                </div>
                <div className="control" style={{ color: '#002f6c', fontSize: '14px' ,fontStyle: 'italic', marginTop: '10px'}}>
                  Don't have an account?
                  <Link to="/register">Register</Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Login;