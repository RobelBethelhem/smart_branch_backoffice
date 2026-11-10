import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import {jwtDecode} from 'jwt-decode';
import boolImage from './views/admin/Letters/bool.png';
import './loadingSpinner.css';

import { useDispatch, useSelector } from 'react-redux';

// Access tokens the server has already confirmed in this tab: token -> time (ms, this PC's
// clock) until which that answer holds, i.e. the token's own expiry.
//
// Every protected page is wrapped in a PrivateRoute, and each one used to ask the server
// "is this token valid?" before showing anything: one extra request, plus the full-screen
// splash, on every menu click, for every user. The answer cannot change before the token
// expires, so it is asked once per token. Every data request is still checked by the
// backend as before.
const verifiedTokens = new Map();

const isVerified = (token) => {
  const validUntil = verifiedTokens.get(token);
  return !!validUntil && Date.now() < validUntil;
};

const rememberVerified = (token, response) => {
  let remainingMs = 0;
  try {
    const { exp } = jwtDecode(token);
    // Time left is measured against the server's clock (the response's Date header), so a PC
    // whose clock is wrong neither keeps a token too long nor asks again on every click.
    const serverNow = Date.parse(response.headers.get('date') || '') || Date.now();
    remainingMs = exp ? exp * 1000 - serverNow : 0;
  } catch (error) {
    remainingMs = 0;
  }
  verifiedTokens.clear();
  // At least a few seconds, so a token about to expire cannot cause a burst of checks.
  verifiedTokens.set(token, Date.now() + Math.max(5000, remainingMs));
};

const hasAllowedRole = (token, allowedRoles) => {
  try {
    return allowedRoles.includes(jwtDecode(token).roles?.[0]);
  } catch (error) {
    return false;
  }
};

const PrivateRoute = ({ allowedRoles, children }) => {
  const accessToken = useSelector(state => state.user.accessToken);
  //const accessToken = localStorage.getItem('accessToken');
  // The token the server refused (if any), and a counter to re-render once it accepted one.
  const [rejectedToken, setRejectedToken] = useState(null);
  const [, setVerifiedCount] = useState(0);

  const verified = !!accessToken && isVerified(accessToken);
  const needsCheck = !!accessToken && !verified && rejectedToken !== accessToken;

  useEffect(() => {
    if (!needsCheck) return undefined;

    let cancelled = false;
    const verifyToken = async () => {
      try {
        const response = await fetch('/api/api/verify-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': accessToken
          }
        });

        if (response.ok) {
          rememberVerified(accessToken, response);
          if (!cancelled) setVerifiedCount(count => count + 1);
        } else if (!cancelled) {
          setRejectedToken(accessToken);
        }
      } catch (error) {
        console.error('Error verifying token:', error);
        if (!cancelled) setRejectedToken(accessToken);
      }
    };

    verifyToken();
    return () => { cancelled = true; };
  }, [accessToken, needsCheck]);

  if (needsCheck) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '20px',
        background: '#ffffff'  // White background
      }}>
        <img
          src={boolImage}
          alt="Company Logo"
          style={{
            width: '500px',
            height: 'auto',
            marginBottom: '20px'
          }}
        />
        <div className="spinner-multi"></div> {/* Choose: spinner, spinner-multi, or spinner-gradient */}
      </div>
    );
  }

  if (!accessToken || !verified || !hasAllowedRole(accessToken, allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return children ? children : <Outlet />;
};

export default PrivateRoute;
