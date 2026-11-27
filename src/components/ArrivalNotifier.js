import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { CDropdown, CDropdownMenu, CDropdownToggle } from '@coreui/react';
import { Bell, Volume2, VolumeX, X } from 'lucide-react';
import { arrivalLine, c360Fetch, initialsOf } from '../views/customer360/api';
import '../views/customer360/Customer360.css';

// The Customer 360 notification: the bell in the header and the cards that slide in when a
// customer's request gets a teller.
//
// How it hears about an arrival: it asks the server every few seconds for arrivals newer
// than the newest one it has. The branch PCs have no internet and the backoffice runs on
// plain HTTP, so the browser's own push service and system notifications are not available;
// asking the server is what works there. When the page is opened over HTTPS, a system
// notification is shown as well (once the user has allowed it from the bell menu).

const CANDIDATE_ROLES = ['Admin', 'Authorizer', 'Auditor', 'Teller', 'Maker'];
const POLL_MS = 8000;
const NOT_ELIGIBLE_POLL_MS = 60000;
const RETRY_MS = 30000;
const FULL_REFRESH_EVERY = 8;        // every 8th question asks for the whole day, to pick up "seen"
const POP_MS = 20000;
const SOUND_KEY = 'c360-sound';

const readSoundPref = () => {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  } catch (error) {
    return true;
  }
};

const canUseSystemNotifications = () =>
  typeof window !== 'undefined' && window.isSecureContext === true && 'Notification' in window;

// Two short notes. No sound file: it is made on the spot.
function chime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.setValueAtTime(1175, now + 0.14);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.55);
    oscillator.onended = () => context.close();
  } catch (error) {
    // No sound is not worth an error.
  }
}

const ArrivalNotifier = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.user.accessToken);
  const role = useSelector((state) => state.user.role);
  const candidate = !!accessToken && CANDIDATE_ROLES.includes(role);
  // Set by the Customer 360 page when an arrival has been opened (from anywhere).
  const seenId = useSelector((state) => state.customer360Seen);

  const [eligible, setEligible] = useState(false);
  const [arrivals, setArrivals] = useState([]);
  const [pops, setPops] = useState([]);
  const [sound, setSound] = useState(readSoundPref);
  const [permission, setPermission] = useState(() => (canUseSystemNotifications() ? window.Notification.permission : 'unavailable'));
  const soundRef = useRef(sound);
  const baseTitle = useRef(typeof document !== 'undefined' ? document.title : '');

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const open = useCallback(
    (arrival) => {
      setPops((current) => current.filter((pop) => pop.id !== arrival.id));
      setArrivals((current) => current.map((item) => (item.id === arrival.id ? { ...item, seen: true } : item)));
      navigate(`/customer360/${arrival.id}`);
    },
    [navigate],
  );

  const announce = useCallback(
    (fresh) => {
      setPops((current) => [...fresh, ...current].slice(0, 4));
      fresh.forEach((arrival) => {
        setTimeout(() => setPops((current) => current.filter((pop) => pop.id !== arrival.id)), POP_MS);
      });
      if (soundRef.current) chime();
      if (canUseSystemNotifications() && window.Notification.permission === 'granted') {
        fresh.forEach((arrival) => {
          try {
            const notification = new window.Notification(`${arrival.customer_name} has arrived`, {
              body: arrivalLine(arrival),
              tag: `c360-${arrival.id}`,
            });
            notification.onclick = () => {
              window.focus();
              open(arrival);
              notification.close();
            };
          } catch (error) {
            // The card inside the page is shown in any case.
          }
        });
      }
    },
    [open],
  );

  useEffect(() => {
    if (!candidate) {
      setEligible(false);
      setArrivals([]);
      setPops([]);
      dispatch({ type: 'set', customer360Eligible: false });
      return undefined;
    }

    let cancelled = false;
    let timer = null;
    let firstAnswer = true;
    let newest = null;
    let count = 0;
    let lastEligible = null;
    const known = new Set();

    const ask = async () => {
      let delay = POLL_MS;
      try {
        const fullRefresh = firstAnswer || count % FULL_REFRESH_EVERY === 0;
        count += 1;
        const path = !fullRefresh && newest ? `/arrivals?since=${encodeURIComponent(newest)}` : '/arrivals';
        const data = await c360Fetch(accessToken, path);
        if (cancelled) return;

        if (data.eligible !== lastEligible) {
          lastEligible = data.eligible;
          setEligible(data.eligible);
          dispatch({ type: 'set', customer360Eligible: data.eligible });
        }

        if (!data.eligible) {
          delay = NOT_ELIGIBLE_POLL_MS;
          setArrivals([]);
        } else {
          const fresh = data.arrivals.filter((arrival) => !known.has(arrival.id));
          data.arrivals.forEach((arrival) => known.add(arrival.id));
          if (data.arrivals.length > 0 && (!newest || data.arrivals[0].arrived_at > newest)) newest = data.arrivals[0].arrived_at;

          if (fullRefresh) {
            setArrivals(data.arrivals);
          } else if (fresh.length > 0) {
            setArrivals((current) => [...fresh, ...current]);
          }
          // Arrivals that were already there when the page was opened are listed, not announced.
          if (!firstAnswer && fresh.length > 0) announce(fresh.filter((arrival) => !arrival.seen));
          firstAnswer = false;
        }
      } catch (failure) {
        if (cancelled) return;
        // The login has ended (the token is valid for 15 minutes): stop asking. The next
        // click takes the user to the login page as usual.
        if ([400, 401, 403].includes(failure.status)) return;
        delay = RETRY_MS;
      }
      if (!cancelled) timer = setTimeout(ask, delay);
    };

    ask();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accessToken, candidate, announce, dispatch]);

  useEffect(() => {
    if (!seenId) return;
    setArrivals((current) => current.map((item) => (item.id === seenId && !item.seen ? { ...item, seen: true } : item)));
    setPops((current) => current.filter((pop) => pop.id !== seenId));
  }, [seenId, arrivals.length]);

  const unseen = arrivals.filter((arrival) => !arrival.seen).length;

  // The number also goes into the tab's title, so it is visible when another tab is in front.
  useEffect(() => {
    document.title = unseen > 0 ? `(${unseen}) Customer arrived · ${baseTitle.current}` : baseTitle.current;
    const original = baseTitle.current;
    return () => {
      document.title = original;
    };
  }, [unseen]);

  if (!candidate || !eligible) return null;

  const toggleSound = () => {
    setSound((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
      } catch (error) {
        // The choice then lasts until the page is reloaded.
      }
      if (next) chime();
      return next;
    });
  };

  const askPermission = async () => {
    try {
      setPermission(await window.Notification.requestPermission());
    } catch (error) {
      setPermission('denied');
    }
  };

  return (
    <>
      <CDropdown variant="nav-item" placement="bottom-end" className="c360n">
        <CDropdownToggle caret={false} aria-label={`Customer arrivals, ${unseen} new`}>
          <span className="c360n-bell">
            <Bell size={20} aria-hidden="true" />
            {unseen > 0 && <span className="c360n-count">{unseen > 9 ? '9+' : unseen}</span>}
          </span>
        </CDropdownToggle>
        <CDropdownMenu className="c360n-menu">
          <div className="c360n-menu-head">
            <span>Customers arrived today</span>
            <button type="button" className="c360n-icon-btn" onClick={toggleSound}
              title={sound ? 'Sound is on. Click to switch it off.' : 'Sound is off. Click to switch it on.'}
              aria-label={sound ? 'Switch the sound off' : 'Switch the sound on'}>
              {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
          </div>
          {arrivals.length === 0 ? (
            <div className="c360n-empty">No customer has been assigned to a teller yet today.</div>
          ) : (
            <div className="c360n-items">
              {arrivals.slice(0, 12).map((arrival) => (
                <button type="button" className="c360n-item" key={arrival.id} onClick={() => open(arrival)}>
                  <span className={`c360n-item-dot${arrival.seen ? ' is-seen' : ''}`} aria-hidden="true" />
                  <span className="c360n-item-text">
                    <span className="c360n-item-name" style={{ display: 'block' }}>
                      {arrival.customer_name}{arrival.simulated ? ' (simulated)' : ''}
                    </span>
                    <span className="c360n-item-sub" style={{ display: 'block' }}>{arrivalLine(arrival)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="c360n-menu-foot">
            <button type="button" className="c360n-link" onClick={() => navigate('/customer360')}>See all</button>
            {permission === 'default' && (
              <button type="button" className="c360n-link" onClick={askPermission}>Turn on desktop notifications</button>
            )}
          </div>
        </CDropdownMenu>
      </CDropdown>

      {pops.length > 0 &&
        createPortal(
          <div className="c360n c360n-stack" role="status" aria-live="polite">
            {pops.map((arrival) => (
              <div className="c360n-pop" key={arrival.id}>
                <span className="c360n-pop-avatar" aria-hidden="true">{initialsOf(arrival.customer_name)}</span>
                <div className="c360n-pop-body">
                  <div className="c360n-pop-title">{arrival.customer_name} has arrived</div>
                  <div className="c360n-pop-sub">{arrivalLine(arrival)}{arrival.simulated ? ' · simulated' : ''}</div>
                  <div className="c360n-pop-actions">
                    <button type="button" className="c360-btn is-primary" onClick={() => open(arrival)}>View Customer 360</button>
                  </div>
                </div>
                <button type="button" className="c360n-icon-btn" aria-label="Dismiss"
                  onClick={() => setPops((current) => current.filter((pop) => pop.id !== arrival.id))}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
};

export default ArrivalNotifier;
