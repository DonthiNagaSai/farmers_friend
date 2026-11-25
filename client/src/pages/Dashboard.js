import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Dashboard.css';
import CenteredModal from '../components/CenteredModal';
import BackButton from '../components/BackButton';
import SoilGauges from '../components/SoilGauges';
import QuickStats from '../components/QuickStats';
import WeatherWidget from '../components/WeatherWidget';
import StudentDashboard from './StudentDashboard';
import AnalystDashboard from './AnalystDashboard';

const API_BASE = (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/$/, '') : '') || '/api';

// Utility function to derive name from email
const deriveNameFromEmail = (email) => {
  if (!email) return null;
  const local = String(email).split('@')[0];
  const spaced = local.replace(/[._\-+]+/g, ' ');
  return spaced.split(' ').map(s => s ? (s[0].toUpperCase() + s.slice(1)) : '').join(' ').trim();
};

// Utility function to format file size
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// Utility function to validate soil inputs
const validateSoilInputs = (inputs) => {
  const errors = [];
  const ph = parseFloat(inputs.ph);
  if (!Number.isFinite(ph) || ph < 0 || ph > 14) errors.push('pH must be between 0 and 14');
  if (inputs.nitrogen < 0 || inputs.nitrogen > 200) errors.push('Nitrogen must be between 0 and 200');
  if (inputs.phosphorus < 0 || inputs.phosphorus > 200) errors.push('Phosphorus must be between 0 and 200');
  if (inputs.potassium < 0 || inputs.potassium > 200) errors.push('Potassium must be between 0 and 200');
  if (inputs.moisture < 0 || inputs.moisture > 100) errors.push('Moisture must be between 0 and 100');
  if (inputs.temperature < -10 || inputs.temperature > 60) errors.push('Temperature must be between -10 and 60°C');
  return errors;
};

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const fallbackAuth = (() => { 
    try { 
      const raw = sessionStorage.getItem('auth'); 
      return raw ? JSON.parse(raw) : null 
    } catch (e) { 
      return null 
    } 
  })();
  
  const role = location.state?.role || fallbackAuth?.role || 'user';
  const user = location.state?.user || fallbackAuth?.user || null;

  // State management
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const uploadInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('none');
  const [previewUser, setPreviewUser] = useState(false);
  const [selectedPreviewUserId, setSelectedPreviewUserId] = useState(null);
  const [previewRole, setPreviewRole] = useState(null);
  const [previewHistory, setPreviewHistory] = useState([]); // Track preview navigation history
  const [studentDatasetLoaded, setStudentDatasetLoaded] = useState(false); // Track if student loaded a dataset
  const [studentClearCounter, setStudentClearCounter] = useState(0); // Counter to trigger clear
  const [analystDatasetLoaded, setAnalystDatasetLoaded] = useState(false); // Track if analyst loaded a dataset
  const [analystClearCounter, setAnalystClearCounter] = useState(0); // Counter to trigger clear
  const [showProfile, setShowProfile] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [modal, setModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [notification, setNotification] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    bio: ''
  });
  const [previewProfileData, setPreviewProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    bio: ''
  });

  const initialSoil = { ph: 6.5, nitrogen: 60, phosphorus: 30, potassium: 80, moisture: 45, temperature: 25 };
  const [soilInputs, setSoilInputs] = useState(initialSoil);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [predictionResult, setPredictionResult] = useState(null);

  // Refs for click-outside detection
  const profileRef = useRef(null);
  const historyRef = useRef(null);

  // Derive user name
  const name = (() => {
    if (location.state && location.state.name) return location.state.name;
    if (fallbackAuth && fallbackAuth.name) return fallbackAuth.name;
    if (user) {
      if (user.firstName) return `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`;
      if (user.name) return user.name;
      const fromEmail = deriveNameFromEmail(user.email);
      if (fromEmail) return fromEmail;
      if (user.phone) return user.phone;
    }
    return 'Guest';
  })();

  // Show notification helper
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Handle back navigation in preview mode
  const handlePreviewBack = useCallback(() => {
    if (previewHistory.length > 0) {
      // Pop the last preview state from history
      const previousState = previewHistory[previewHistory.length - 1];
      setPreviewHistory(prev => prev.slice(0, -1));
      setPreviewRole(previousState.role);
      setSelectedPreviewUserId(previousState.userId);
    } else {
      // If no preview history, exit preview mode
      setPreviewUser(false);
      setPreviewRole(null);
      setSelectedPreviewUserId(null);
    }
  }, [previewHistory]);

  // Handle back button click - check various states before using navigate(-1)
  const handleBackButton = useCallback(() => {
    // If in preview mode, use preview history
    if (previewUser) {
      handlePreviewBack();
      return;
    }
    
    // If admin has an active tab (users or datasets), close it first
    if (role === 'admin' && activeTab !== 'none') {
      setActiveTab('none');
      return;
    }
    
    // If student has loaded a dataset, clear it first
    if (role === 'student' && studentDatasetLoaded) {
      setStudentDatasetLoaded(false);
      setStudentClearCounter(prev => prev + 1); // Increment to trigger clear
      return;
    }
    
    // If analyst has loaded a dataset, clear it first
    if (role === 'analyst' && analystDatasetLoaded) {
      setAnalystDatasetLoaded(false);
      setAnalystClearCounter(prev => prev + 1); // Increment to trigger clear
      return;
    }
    
    // Before going back to landing page, show logout confirmation
    setModal({
      title: 'Logout Confirmation',
      message: 'Do you want to logout?',
      actions: (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button 
            className="btn" 
            onClick={() => {
              setModal(null);
              try { sessionStorage.removeItem('auth'); } catch(e){}
              try { localStorage.removeItem('ff_token'); } catch(e){}
              if (role === 'admin') setHistory([]);
              showNotification('Logged out successfully', 'success');
              navigate('/');
            }}
            style={{ background: '#d32f2f', color: 'white' }}
          >
            Yes, Logout
          </button>
          <button 
            className="btn" 
            onClick={() => setModal(null)}
            style={{ background: '#757575', color: 'white' }}
          >
            No, Stay
          </button>
        </div>
      )
    });
  }, [previewUser, handlePreviewBack, role, activeTab, studentDatasetLoaded, analystDatasetLoaded, showNotification, navigate]);

  // Fetch users with error handling
  // Fetch users with error handling
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try { 
      const res = await fetch(`${API_BASE}/users`); 
      if (!res.ok) throw new Error('Failed to fetch users');
      const json = await res.json(); 
  setUsers(json);
    } catch (err) { 
      console.error(err); 
      setModal({ title: 'Error', message: 'Failed to load users. Please try again.' }); 
      showNotification('Failed to load users', 'error');
    } finally { 
      setLoading(false); 
    }
  }, [showNotification]);

  // Toggle user status
  const toggleUser = useCallback(async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/toggle`, { method: 'PATCH' });
      const json = await res.json();
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? json.user : u));
      } else {
        setModal({ title: 'Error', message: json.error || 'Failed to toggle user status' });
        showNotification('Failed to update user', 'error');
      }
    } catch (err) { 
      console.error(err); 
      setModal({ title: 'Error', message: 'Server error. Please try again.' }); 
      showNotification('Server error', 'error');
    }
  }, [showNotification]);

  // Fetch datasets
  const fetchDatasets = useCallback(async () => { 
    try { 
      const res = await fetch(`${API_BASE}/admin/datasets`); 
      if (!res.ok) throw new Error('Failed to fetch datasets');
      const list = await res.json(); 
  setDatasets(list);
    } catch (err) { 
      console.error(err); 
      setDatasets([]);
      showNotification('Failed to load datasets', 'error');
    } 
  }, [showNotification]);

  useEffect(() => { if (role === 'admin' && activeTab === 'users') fetchUsers(); }, [role, activeTab, fetchUsers]);
  useEffect(() => { if (role === 'admin' && activeTab === 'datasets') fetchDatasets(); }, [role, activeTab, fetchDatasets]);

  // Load user history on mount (for regular users)
  useEffect(() => {
    const loadHistory = async () => {
      // Only load history for non-admin users
      if (role !== 'admin' && role === 'user' && user && (user.id || user.phone)) {
        try {
          const userId = user.id || user.phone;
          const response = await fetch(`${API_BASE}/history/${userId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.history && Array.isArray(data.history)) {
              setHistory(data.history);
            }
          }
        } catch (err) {
          console.error('Failed to load history:', err);
          // Silently fail - user can still use the app with empty history
        }
      }
    };
    loadHistory();
  }, [role, user]);

  // Save history to server whenever it changes (debounced)
  useEffect(() => {
    // Save ONLY for regular users (NOT admin, even in preview mode)
    const shouldSave = (role !== 'admin' && role === 'user' && user && (user.id || user.phone));
    
    if (shouldSave && history.length > 0) {
      const saveHistory = async () => {
        try {
          const userId = user.id || user.phone;
            
          await fetch(`${API_BASE}/history/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, history })
          });
        } catch (err) {
          console.error('Failed to save history:', err);
          // Silently fail - history still works in current session
        }
      };
      
      // Debounce: wait 2 seconds after last history change before saving
      const timer = setTimeout(saveHistory, 2000);
      return () => clearTimeout(timer);
    }
  }, [history, role, user]);

  // Load history when switching between preview users in admin mode
  useEffect(() => {
    const loadPreviewHistory = async () => {
      if (role === 'admin' && previewUser && selectedPreviewUserId) {
        // Clear current history and results first
        setHistory([]);
        setAnalysisResult(null);
        setPredictionResult(null);
        
        // Load the selected user's history from server
        try {
          const response = await fetch(`${API_BASE}/history/${selectedPreviewUserId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.history && Array.isArray(data.history)) {
              setHistory(data.history);
            }
          }
        } catch (err) {
          console.error('Failed to load preview user history:', err);
          // Silently fail - preview mode can still work with empty history
        }
      }
    };
    loadPreviewHistory();
  }, [selectedPreviewUserId, role, previewUser]);

  // Clear history when switching between preview roles (farmer/student/analyst)
  useEffect(() => {
    if (role === 'admin' && previewUser && previewRole) {
      // When switching to student or analyst mode, clear history
      setHistory([]);
      setAnalysisResult(null);
      setPredictionResult(null);
    }
  }, [previewRole, role, previewUser]);

  // Load user profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (user && (user.id || user.phone)) {
        try {
          const userId = user.id || user.phone;
          const response = await fetch(`${API_BASE}/profile/${userId}`);
          if (response.ok) {
            const data = await response.json();
            // Merge with user object to ensure basic fields are populated
            setProfileData({
              firstName: data.firstName || user.firstName || '',
              lastName: data.lastName || user.lastName || '',
              email: data.email || user.email || '',
              phone: data.phone || user.phone || '',
              address: data.address || '',
              city: data.city || '',
              state: data.state || '',
              zipCode: data.zipCode || '',
              country: data.country || '',
              bio: data.bio || ''
            });
          } else {
            // If fetch fails, use user object data
            setProfileData({
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              email: user.email || '',
              phone: user.phone || '',
              address: '',
              city: '',
              state: '',
              zipCode: '',
              country: '',
              bio: ''
            });
          }
        } catch (err) {
          console.error('Failed to load profile:', err);
          // Fallback to user object on error
          setProfileData({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            phone: user.phone || '',
            address: '',
            city: '',
            state: '',
            zipCode: '',
            country: '',
            bio: ''
          });
        }
      }
    };
    loadProfile();
  }, [user]);

  // Load preview user's profile when admin previews
  useEffect(() => {
    const loadPreviewProfile = async () => {
      if (role === 'admin' && previewUser && selectedPreviewUserId) {
        // Get basic user data from users array as fallback
        const basicUser = users.find(u => (u.id || u.phone) === selectedPreviewUserId);
        
        try {
          const response = await fetch(`${API_BASE}/profile/${selectedPreviewUserId}`);
          if (response.ok) {
            const data = await response.json();
            // Merge profile data with basic user data, preferring profile data when available
            setPreviewProfileData({
              firstName: data.firstName || basicUser?.firstName || '',
              lastName: data.lastName || basicUser?.lastName || '',
              email: data.email || basicUser?.email || '',
              phone: data.phone || basicUser?.phone || '',
              address: data.address || '',
              city: data.city || '',
              state: data.state || '',
              zipCode: data.zipCode || '',
              country: data.country || '',
              bio: data.bio || ''
            });
          } else if (basicUser) {
            // If profile fetch fails, use basic user data
            setPreviewProfileData({
              firstName: basicUser.firstName || '',
              lastName: basicUser.lastName || '',
              email: basicUser.email || '',
              phone: basicUser.phone || '',
              address: '',
              city: '',
              state: '',
              zipCode: '',
              country: '',
              bio: ''
            });
          }
        } catch (err) {
          console.error('Failed to load preview profile:', err);
          // Fallback to basic user data on error
          if (basicUser) {
            setPreviewProfileData({
              firstName: basicUser.firstName || '',
              lastName: basicUser.lastName || '',
              email: basicUser.email || '',
              phone: basicUser.phone || '',
              address: '',
              city: '',
              state: '',
              zipCode: '',
              country: '',
              bio: ''
            });
          }
        }
      }
    };
    loadPreviewProfile();
  }, [role, previewUser, selectedPreviewUserId, users]);

  // Auto-initialize selectedPreviewUserId when preview mode opens
  useEffect(() => {
    if (role === 'admin' && previewUser && users.length > 0 && !selectedPreviewUserId) {
      const filtered = previewRole 
        ? users.filter(u => u.role === previewRole)
        : users.filter(u => !u.role || u.role === 'user');
      
      if (filtered.length > 0) {
        const firstUser = filtered[0];
        setSelectedPreviewUserId(firstUser.id || firstUser.phone);
      }
    }
  }, [role, previewUser, previewRole, users, selectedPreviewUserId]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
        setEditingProfile(false);
      }
      if (historyRef.current && !historyRef.current.contains(event.target)) {
        setShowHistory(false);
      }
    };

    if (showProfile || showHistory) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfile, showHistory]);

  // Update profile
  const handleUpdateProfile = async () => {
    if (!user || !(user.id || user.phone)) {
      showNotification('Unable to update profile', 'error');
      return;
    }

    try {
      const userId = user.id || user.phone;
      
      // Don't send phone field in update - it should never change
      const { phone, ...updateData } = profileData;
      
      const response = await fetch(`${API_BASE}/profile/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (!response.ok) {
        showNotification(data.error || 'Failed to update profile', 'error');
        return;
      }

      setEditingProfile(false);
      
      // Update profileData state with server response (includes phone)
      if (data.user) {
        setProfileData(data.user);
      }
      
      // Update session storage with new data
      try {
        const auth = JSON.parse(sessionStorage.getItem('auth'));
        if (auth && auth.user) {
          auth.user = { ...auth.user, ...data.user };
          sessionStorage.setItem('auth', JSON.stringify(auth));
        }
      } catch (e) {}
      
    } catch (err) {
      console.error('Profile update error:', err);
      showNotification('Failed to update profile', 'error');
    }
  };

  // Handle file change
  const handleFileChange = (e) => { 
    const f = e.target.files && e.target.files[0]; 
    setUploadFile(f || null); 
  };

  // Upload dataset
  const uploadDataset = async () => {
    if (!uploadFile) {
      setModal({ title: 'No File Selected', message: 'Please select a file to upload' });
      return;
    }
    
    setUploading(true);
    try {
      const resp = await fetch(`${API_BASE}/admin/dataset?filename=${encodeURIComponent(uploadFile.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: await uploadFile.arrayBuffer()
      });
      const json = await resp.json();
      
      if (!resp.ok) {
        setModal({ title: 'Upload Failed', message: json.error || 'Failed to upload file' });
        showNotification('Upload failed', 'error');
        return;
      }
      setUploadFile(null);
      try { if (uploadInputRef.current) uploadInputRef.current.value = ''; } catch (e) { /* ignore */ }
      await fetchDatasets();
    } catch (err) {
      console.error(err);
      setModal({ title: 'Error', message: 'Upload error. Please try again.' });
      showNotification('Upload error', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Import dataset
  const importDataset = async (name) => { 
    if (!window.confirm(`Import dataset "${name}" into users? This will merge users by phone.`)) return;
    
    try { 
      const resp = await fetch(`${API_BASE}/admin/datasets/${encodeURIComponent(name)}/import`, { method: 'POST' }); 
      const json = await resp.json(); 
      
      if (!resp.ok) {
        setModal({ title: 'Import Failed', message: json.error || 'Failed to import dataset' });
        showNotification('Import failed', 'error');
        return;
      }
      
  // import succeeded; refresh users without showing a toast
  // showNotification(json.message || 'Dataset imported successfully', 'success');
      fetchUsers(); 
    } catch (err) { 
      console.error(err); 
      setModal({ title: 'Error', message: 'Import error. Please try again.' }); 
      showNotification('Import error', 'error');
    } 
  };

  // Delete dataset
  const deleteDataset = async (name) => {
    if (!window.confirm(`Delete dataset "${name}"? This action cannot be undone.`)) return;
    
    try {
      const resp = await fetch(`${API_BASE}/admin/dataset?file=${encodeURIComponent(name)}`, { method: 'DELETE' });
      const json = await resp.json();
      
      if (!resp.ok) {
        setModal({ title: 'Delete Failed', message: json.error || 'Failed to delete dataset' });
        showNotification('Delete failed', 'error');
        return;
      }
      
  // deletion succeeded; avoid showing a success toast
  // showNotification(`Deleted ${name}`, 'success');
      setDatasets(prev => prev.filter(d => {
        const fname = (typeof d === 'string') ? d : (d.file || '');
        return fname !== name;
      }));
    } catch (err) {
      console.error(err);
      setModal({ title: 'Error', message: 'Delete error. Please try again.' });
      showNotification('Delete error', 'error');
    }
  };

  // Update soil field
  const updateSoilField = (field, value) => { 
    setSoilInputs(s => ({ ...s, [field]: value })); 
  };

  // Analyze soil
  const analyzeSoil = (vals = soilInputs) => { 
    const validationErrors = validateSoilInputs(vals);
    if (validationErrors.length > 0) {
      setModal({ title: 'Invalid Input', message: validationErrors.join(', ') });
      return;
    }

    const messages = []; 
    const ph = parseFloat(vals.ph); 
    
    if (!Number.isFinite(ph)) {
      messages.push('Invalid pH value');
    } else if (ph < 5.5) {
      messages.push('🔴 Soil is acidic - Consider adding lime');
    } else if (ph <= 7) {
      messages.push('🟢 Soil is neutral - Optimal for most crops');
    } else {
      messages.push('🔵 Soil is alkaline - Monitor nutrient availability');
    }
    
    const nk = (v) => (v < 50 ? 'low ⚠️' : v <= 100 ? 'medium ✓' : 'high ✓✓');
    messages.push(`Nitrogen: ${nk(vals.nitrogen)}`);
    messages.push(`Phosphorus: ${nk(vals.phosphorus)}`);
    messages.push(`Potassium: ${nk(vals.potassium)}`);
    messages.push(`Moisture: ${vals.moisture < 30 ? 'low 💧' : vals.moisture <= 60 ? 'moderate 💧💧' : 'high 💧💧💧'}`);
    messages.push(`Temperature: ${Math.round(vals.temperature)}°C ${vals.temperature < 15 ? '🥶 Cold' : vals.temperature <= 30 ? '🌡️ Optimal' : '🔥 Hot'}`);
    
    setAnalysisResult(messages);
    setHistory(h => [{
      id: Date.now(),
      ts: new Date().toISOString(),
      type: 'analysis',
      inputs: vals,
      result: messages
    }, ...h].slice(0, 100));
  };

  // Predict crop using CSV dataset
  const predictCrop = async (vals = soilInputs) => { 
    const validationErrors = validateSoilInputs(vals);
    if (validationErrors.length > 0) {
      setModal({ title: 'Invalid Input', message: validationErrors.join(', ') });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/crop-recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ph: parseFloat(vals.ph),
          nitrogen: Number(vals.nitrogen),
          phosphorus: Number(vals.phosphorus),
          potassium: Number(vals.potassium),
          moisture: Number(vals.moisture),
          temperature: Number(vals.temperature)
        })
      });

      const json = await response.json();
      
      if (!response.ok) {
        setModal({ title: 'Prediction Failed', message: json.error || 'Failed to get crop recommendations' });
        showNotification('Prediction failed', 'error');
        return;
      }

      const recommendations = json.recommendations || [];
      
      if (recommendations.length === 0) {
        setModal({ 
          title: 'No Matches Found', 
          message: 'No crop recommendations found for these soil conditions. Try adjusting the values slightly.' 
        });
        setPredictionResult(['No matches found']);
      } else {
        // Capitalize crop names for display
        const displayRecs = recommendations.map(crop => 
          crop.charAt(0).toUpperCase() + crop.slice(1)
        );
        setPredictionResult(displayRecs);
      }

      setHistory(h => [{
        id: Date.now(),
        ts: new Date().toISOString(),
        type: 'prediction',
        inputs: vals,
        result: recommendations.length > 0 ? recommendations : ['No matches found']
      }, ...h].slice(0, 100));
      
    } catch (err) {
      console.error('Crop prediction error:', err);
      setModal({ title: 'Error', message: 'Failed to connect to recommendation service. Please try again.' });
      showNotification('Prediction error', 'error');
    }
  };

  // Export analysis results
  const exportResults = () => {
    const data = {
      timestamp: new Date().toISOString(),
      soilInputs,
      analysisResult,
      predictionResult,
      history
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soil-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clear history
  const clearHistory = async () => {
    if (role === 'admin' && previewUser && selectedPreviewUserId) {
      // For admin in preview mode: reload the user's saved history (removing only temp additions)
      if (window.confirm('Clear temporary history? This will reload the user\'s saved history from the server.')) {
        try {
          const response = await fetch(`${API_BASE}/history/${selectedPreviewUserId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.history && Array.isArray(data.history)) {
              setHistory(data.history);
            } else {
              setHistory([]);
            }
          } else {
            setHistory([]);
          }
          setAnalysisResult(null);
          setPredictionResult(null);
        } catch (err) {
          console.error('Failed to reload user history:', err);
          setHistory([]);
        }
      }
    } else if (role !== 'admin' && role === 'user') {
      // For regular users only: clear all history
      if (window.confirm('Clear all history? This action cannot be undone.')) {
        setHistory([]);
      }
    } else if (role === 'admin' && !previewUser) {
      // For admin NOT in preview mode: just clear temporary local history
      if (window.confirm('Clear temporary test history?')) {
        setHistory([]);
        setAnalysisResult(null);
        setPredictionResult(null);
      }
    }
  };

  // Handle logout
  const handleLogout = () => { 
    try { 
      sessionStorage.removeItem('auth'); 
    } catch (e) {} 
    
    // Clear history when admin logs out
    if (role === 'admin') {
      setHistory([]);
    }
    
    showNotification('Logged out successfully', 'success');
    navigate('/'); 
  };

  // Toggle section
  const toggleSection = (tab) => {
    if (tab === 'preview') {
      if (!previewUser) {
        setPreviewUser(true);
        setShowProfile(false);
        setShowHistory(false);
        if (users.length === 0 && role === 'admin') {
          fetchUsers().catch(err => setModal({ title: 'Error', message: 'Failed to load users' }));
        }
      } else {
        setPreviewUser(p => {
          const newVal = !p;
          if (!newVal) {
            setShowProfile(false);
            setShowHistory(false);
            setPreviewRole(null);
            setPreviewHistory([]); // Clear preview navigation history
            // Clear history when closing preview mode
            if (role === 'admin') {
              setHistory([]);
              setAnalysisResult(null);
              setPredictionResult(null);
            }
          }
          return newVal;
        });
      }
      setActiveTab('none');
      setShowProfile(false);
      setShowHistory(false);
      return;
    }

    // Clear history when switching to Users or Datasets tabs (away from preview)
    if (role === 'admin' && previewUser) {
      setHistory([]);
      setAnalysisResult(null);
      setPredictionResult(null);
    }
    
    if (previewUser) {
      setPreviewUser(false);
      setPreviewRole(null);
      setPreviewHistory([]); // Clear preview navigation history
    }
    setShowProfile(false);
    setShowHistory(false);
    if (activeTab === tab) setActiveTab('none'); 
    else setActiveTab(tab);
  };

  // Toggle profile
  const toggleProfile = () => {
    setShowProfile(prev => {
      const newVal = !prev;
      if (newVal) {
        setShowHistory(false);
        setActiveTab('none');
      }
      return newVal;
    });
  };

  // Toggle history
  const toggleHistory = () => {
    setShowHistory(prev => {
      const newVal = !prev;
      if (newVal) {
        setShowProfile(false);
        setActiveTab('none');
      }
      return newVal;
    });
  };

  // Filter and search users
  const filteredUsers = users.filter(u => {
    const matchesSearch = searchTerm === '' || 
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone || '').includes(searchTerm);
    
    const matchesFilter = filterStatus === 'all' || 
      (filterStatus === 'active' && u.active) ||
      (filterStatus === 'passive' && !u.active);
    
    return matchesSearch && matchesFilter;
  });

  const headerProfileTarget = (role === 'admin' && previewUser) 
    ? (users.find(u => (u.id || u.phone) === selectedPreviewUserId) || (users.length > 0 ? users[0] : { firstName: 'Preview', lastName: 'Farmer', phone: '-', email: '', active: true })) 
    : user;

  return (
    <div className="dashboard-page">
      {/* Notification Toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-icon">
            {notification.type === 'success' && '✓'}
            {notification.type === 'error' && '✕'}
            {notification.type === 'info' && 'ℹ'}
          </span>
          <span>{notification.message}</span>
        </div>
      )}

      <header className="dash-header">
        <div className="header-left">
          <BackButton 
            label="Back" 
            onClick={handleBackButton}
          />
          <h1>
            {role === 'admin' ? `Admin Dashboard` : 
             role === 'student' ? `Student Dashboard` :
             role === 'analyst' ? `Analyst Dashboard` :
             `Welcome ${name}`}
          </h1>
        </div>
        <div className="header-actions">
          {role === 'admin' && (
            <div className="segmented" role="tablist" aria-label="Admin controls">
              <button 
                role="tab" 
                className={`seg-btn ${activeTab === 'users' ? 'active' : ''}`} 
                onClick={() => toggleSection('users')} 
                aria-expanded={activeTab === 'users'}
                title="Manage users"
              >
                👥 Users
              </button>
              <button 
                role="tab" 
                className={`seg-btn ${activeTab === 'datasets' ? 'active' : ''}`} 
                onClick={() => toggleSection('datasets')} 
                aria-expanded={activeTab === 'datasets'}
                title="Manage datasets"
              >
                📊 Datasets
              </button>
              <button 
                role="tab" 
                className={`seg-btn ${previewUser && !previewRole ? 'active' : ''}`} 
                onClick={() => {
                  if (previewUser && previewRole !== null) {
                    // Save current state to history before changing
                    setPreviewHistory(prev => [...prev, { role: previewRole, userId: selectedPreviewUserId }]);
                    setPreviewRole(null); 
                    setSelectedPreviewUserId(null); 
                    return; 
                  }
                  setPreviewRole(null);
                  toggleSection('preview');
                }}
                title="Preview farmer view"
              >
                {previewUser && !previewRole ? '✕ Close Farmer' : '👨‍🌾 Preview Farmer'}
              </button>
              <button 
                role="tab" 
                className={`seg-btn ${previewUser && previewRole === 'student' ? 'active' : ''}`} 
                onClick={() => {
                  if (previewUser) {
                    // Save current state to history before changing
                    if (previewRole !== 'student') {
                      setPreviewHistory(prev => [...prev, { role: previewRole, userId: selectedPreviewUserId }]);
                    }
                    setPreviewRole('student'); 
                    setSelectedPreviewUserId(null); 
                    return; 
                  }
                  setPreviewRole('student');
                  toggleSection('preview');
                }}
                title="Preview student view"
              >
                🎓 Preview Student
              </button>
              <button 
                role="tab" 
                className={`seg-btn ${previewUser && previewRole === 'analyst' ? 'active' : ''}`} 
                onClick={() => {
                  if (previewUser) {
                    // Save current state to history before changing
                    if (previewRole !== 'analyst') {
                      setPreviewHistory(prev => [...prev, { role: previewRole, userId: selectedPreviewUserId }]);
                    }
                    setPreviewRole('analyst'); 
                    setSelectedPreviewUserId(null); 
                    return; 
                  }
                  setPreviewRole('analyst');
                  toggleSection('preview');
                }}
                title="Preview analyst view"
              >
                📈 Preview Analyst
              </button>
            </div>
          )}
          <button className="btn-logout" onClick={handleLogout} title="Logout">
            🚪 Logout
          </button>

          {role !== 'admin' && (
            <div className="header-user-controls" ref={profileRef}>
              <button 
                className={`btn-profile ${showProfile ? 'active' : ''}`} 
                onClick={toggleProfile}
                title="View profile"
              >
                {showProfile ? 'Hide Profile' : '👤 Profile'}
              </button>
              {showProfile && (
                <div className="profile-dropdown">
                  {!editingProfile ? (
                    <>
                      <div className="user-card">
                        <h4>{profileData.firstName} {profileData.lastName}</h4>
                        <div className="profile-info">
                          <div className="profile-row">
                            <span className="profile-label">📧 Email:</span>
                            <span>{profileData.email || '-'}</span>
                          </div>
                          <div className="profile-row">
                            <span className="profile-label">📱 Phone:</span>
                            <span>{profileData.phone || '-'}</span>
                          </div>
                          {profileData.address && (
                            <div className="profile-row">
                              <span className="profile-label">🏠 Address:</span>
                              <span>{profileData.address}</span>
                            </div>
                          )}
                          {profileData.city && (
                            <div className="profile-row">
                              <span className="profile-label">🌆 City:</span>
                              <span>{profileData.city}</span>
                            </div>
                          )}
                          {profileData.state && (
                            <div className="profile-row">
                              <span className="profile-label">📍 State:</span>
                              <span>{profileData.state}</span>
                            </div>
                          )}
                          {profileData.zipCode && (
                            <div className="profile-row">
                              <span className="profile-label">📮 Zip:</span>
                              <span>{profileData.zipCode}</span>
                            </div>
                          )}
                          {profileData.country && (
                            <div className="profile-row">
                              <span className="profile-label">🌍 Country:</span>
                              <span>{profileData.country}</span>
                            </div>
                          )}
                          {profileData.bio && (
                            <div className="profile-row">
                              <span className="profile-label">ℹ️ Bio:</span>
                              <span>{profileData.bio}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button 
                        className="btn-edit-profile" 
                        onClick={() => setEditingProfile(true)}
                      >
                        ✏️ Edit Profile
                      </button>
                    </>
                  ) : (
                    <div className="profile-edit-form">
                      <h4>Edit Profile</h4>
                      <div className="form-group">
                        <label>First Name</label>
                        <input 
                          type="text" 
                          value={profileData.firstName} 
                          onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                        />
                      </div>
                      <div className="form-group">
                        <label>Last Name</label>
                        <input 
                          type="text" 
                          value={profileData.lastName} 
                          onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                        />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input 
                          type="email" 
                          value={profileData.email} 
                          onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                        />
                      </div>
                      <div className="form-group">
                        <label>Address</label>
                        <input 
                          type="text" 
                          value={profileData.address} 
                          onChange={(e) => setProfileData({...profileData, address: e.target.value})}
                          placeholder="Street address"
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>City</label>
                          <input 
                            type="text" 
                            value={profileData.city} 
                            onChange={(e) => setProfileData({...profileData, city: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label>State</label>
                          <input 
                            type="text" 
                            value={profileData.state} 
                            onChange={(e) => setProfileData({...profileData, state: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Zip Code</label>
                          <input 
                            type="text" 
                            value={profileData.zipCode} 
                            onChange={(e) => setProfileData({...profileData, zipCode: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label>Country</label>
                          <input 
                            type="text" 
                            value={profileData.country} 
                            onChange={(e) => setProfileData({...profileData, country: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Bio</label>
                        <textarea 
                          value={profileData.bio} 
                          onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                          placeholder="Tell us about yourself..."
                          rows={3}
                        />
                      </div>
                      <div className="form-actions">
                        <button 
                          className="btn-save-profile" 
                          onClick={handleUpdateProfile}
                        >
                          💾 Save Changes
                        </button>
                        <button 
                          className="btn-cancel-profile" 
                          onClick={() => setEditingProfile(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {role !== 'student' && role !== 'analyst' && (
                <div ref={historyRef}>
                  <button 
                    className={`btn history-btn ${showHistory ? 'active' : ''}`} 
                    onClick={toggleHistory}
                    title="View history"
                  >
                    {showHistory ? 'Hide History' : '📜 History'}
                  </button>
                  {showHistory && (
                    <div className="history-dropdown">
                      <div className="history-actions">
                        <button 
                          className="btn-clear" 
                          onClick={clearHistory}
                          disabled={history.length === 0}
                          title="Clear all history"
                        >
                          🗑️ Clear History
                        </button>
                      </div>
                      {history.length === 0 ? (
                        <p className="empty-state">No history yet. Analyze soil or predict crops to see history.</p>
                      ) : (
                        <ul className="history-list">
                          {history.map(h => (
                            <li key={h.id} className="history-entry">
                              <div className="history-meta">
                                {h.type === 'analysis' ? '🔬' : '🌾'} {h.type} • {new Date(h.ts).toLocaleString()}
                              </div>
                              <div className="history-summary">
                                {Array.isArray(h.result) ? h.result.join(', ') : String(h.result)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        {role === 'admin' ? (
          <div className="admin-panel">
            {activeTab === 'none' && !previewUser && (
              <div className="admin-welcome-screen">
                <div className="welcome-overlay">
                  <div className="welcome-content">
                    <div className="welcome-icon">👨‍💼</div>
                    <h2 className="welcome-title">Welcome to Admin Dashboard</h2>
                    <p className="welcome-subtitle">Manage your platform with ease</p>
                    
                    <div className="welcome-cards">
                      <div className="welcome-card" onClick={() => toggleSection('users')}>
                        <div className="card-icon">👥</div>
                        <h3>Manage Users</h3>
                        <p>View, activate, or deactivate user accounts</p>
                        <div className="card-arrow">→</div>
                      </div>
                      
                      <div className="welcome-card" onClick={() => toggleSection('datasets')}>
                        <div className="card-icon">📊</div>
                        <h3>Manage Datasets</h3>
                        <p>Upload, download, or delete datasets</p>
                        <div className="card-arrow">→</div>
                      </div>
                      
                      <div className="welcome-card" onClick={() => { setPreviewRole(null); toggleSection('preview'); }}>
                        <div className="card-icon">👨‍🌾</div>
                        <h3>Preview Farmer</h3>
                        <p>Experience the farmer dashboard view</p>
                        <div className="card-arrow">→</div>
                      </div>
                      
                      <div className="welcome-card" onClick={() => { setPreviewRole('student'); toggleSection('preview'); }}>
                        <div className="card-icon">🎓</div>
                        <h3>Preview Student</h3>
                        <p>Experience the student dashboard view</p>
                        <div className="card-arrow">→</div>
                      </div>
                      
                      <div className="welcome-card" onClick={() => { setPreviewRole('analyst'); toggleSection('preview'); }}>
                        <div className="card-icon">📈</div>
                        <h3>Preview Analyst</h3>
                        <p>Experience the analyst dashboard view</p>
                        <div className="card-arrow">→</div>
                      </div>
                    </div>
                    
                    <div className="welcome-stats">
                      <div className="stat-item">
                        <div className="stat-value">{users.length}</div>
                        <div className="stat-label">Total Users</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{users.filter(u => u.active).length}</div>
                        <div className="stat-label">Active Users</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{datasets.length}</div>
                        <div className="stat-label">Datasets</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="welcome-background"></div>
              </div>
            )}
            
            {activeTab === 'users' && (
              <>
                <div className="admin-controls">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="🔍 Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <select 
                    className="filter-select"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All Users</option>
                    <option value="active">Active Only</option>
                    <option value="passive">Passive Only</option>
                  </select>
                  <div className="user-stats">
                    Total: {users.length} | Active: {users.filter(u => u.active).length}
                  </div>
                </div>

                {loading ? (
                  <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading users...</p>
                  </div>
                ) : (
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr><td colSpan={6}>No users found</td></tr>
                      ) : (
                        filteredUsers.map(u => (
                          <tr key={u.id}>
                            <td>{u.firstName} {u.lastName || ''}</td>
                            <td>{u.phone}</td>
                            <td>{u.email || '-'}</td>
                            <td>
                              <span className={`role-badge ${u.role || 'user'}`}>
                                {u.role === 'student' ? '🎓 Student' : u.role === 'analyst' ? '📊 Analyst' : '🌾 Farmer'}
                              </span>
                            </td>
                            <td>
                              <span className={`status ${u.active ? 'green' : 'red'}`}>
                                {u.active ? '✓ Active' : '○ Passive'}
                              </span>
                            </td>
                            <td>
                              <button 
                                className="toggle-btn" 
                                onClick={() => toggleUser(u.id)}
                                title={u.active ? 'Set to passive' : 'Set to active'}
                              >
                                {u.active ? 'Set Passive' : 'Set Active'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {activeTab === 'datasets' && (
              <div className="dataset-panel">
                <div className="upload-section">
                  <h3>📤 Upload Dataset</h3>
                  <div className="upload-row">
                    <input 
                      ref={uploadInputRef} 
                      type="file" 
                      onChange={handleFileChange}
                      accept=".csv,.xlsx,.xls,.json"
                    />
                    <button 
                      onClick={uploadDataset} 
                      disabled={uploading || !uploadFile}
                      className="btn-upload"
                    >
                      {uploading ? '⏳ Uploading...' : '📤 Upload'}
                    </button>
                  </div>
                  {uploadFile && (
                    <div className="file-info">
                      Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                    </div>
                  )}
                </div>

                <div className="datasets-list">
                  <h3>📚 Available Datasets</h3>
                  {datasets.length === 0 ? (
                    <p className="empty-state">No datasets uploaded yet</p>
                  ) : (
                    <ul>
                      {datasets.map((d, idx) => {
                        const file = typeof d === 'string' ? d : d.file || `dataset-${idx}`;
                        const original = typeof d === 'object' && d.originalName ? d.originalName : null;
                        const size = typeof d === 'object' && d.size ? d.size : null;
                        return (
                          <li key={file} className="dataset-item">
                            <div className="dataset-info">
                              <span className="dataset-name">📄 {original || file}</span>
                              {size && <small className="dataset-size">{formatFileSize(size)}</small>}
                            </div>
                            <div className="dataset-actions">
                              <button 
                                onClick={() => importDataset(file)}
                                className="btn-import"
                                title="Import dataset"
                              >
                                ⬇️ Import
                              </button>
                              <a 
                                className="btn-download" 
                                href={`${API_BASE}/admin/dataset?file=${encodeURIComponent(file)}`} 
                                target="_blank" 
                                rel="noreferrer"
                                title="Download dataset"
                              >
                                💾 Download
                              </a>
                              <button 
                                className="btn-delete" 
                                onClick={() => deleteDataset(file)}
                                title="Delete dataset"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : role === 'student' ? (
          <div style={{ width: '100%' }}>
            <StudentDashboard 
              history={history} 
              analyses={[]} 
              onClearDataset={() => setStudentDatasetLoaded(false)}
              clearDatasetTrigger={studentClearCounter}
              onDatasetLoaded={() => setStudentDatasetLoaded(true)}
            />
          </div>
        ) : role === 'analyst' ? (
          <div style={{ width: '100%' }}>
            <AnalystDashboard 
              onDatasetLoaded={() => setAnalystDatasetLoaded(true)}
              clearDatasetTrigger={analystClearCounter}
            />
          </div>
        ) : (
          <div className="user-panel">
            <div className="soil-section">
              <div className="section-header">
                <h3>🌱 Soil Analysis & Crop Prediction</h3>
                <button 
                  className="btn-export" 
                  onClick={exportResults}
                  title="Export results"
                  disabled={!analysisResult && !predictionResult}
                >
                  📥 Export Results
                </button>
              </div>

              <div className="soil-grid">
                <div className="soil-three-col">
                  <div className="col-inputs">
                    <label>
                      pH
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0"
                        max="14"
                        value={soilInputs.ph} 
                        onChange={(e) => updateSoilField('ph', e.target.value)}
                      />
                    </label>
                    <label>
                      N (Nitrogen)
                      <input 
                        type="number" 
                        min="0"
                        max="200"
                        value={soilInputs.nitrogen} 
                        onChange={(e) => updateSoilField('nitrogen', e.target.value)}
                      />
                    </label>
                    <label>
                      P (Phosphorus)
                      <input 
                        type="number" 
                        min="0"
                        max="200"
                        value={soilInputs.phosphorus} 
                        onChange={(e) => updateSoilField('phosphorus', e.target.value)}
                      />
                    </label>
                    <label>
                      K (Potassium)
                      <input 
                        type="number" 
                        min="0"
                        max="200"
                        value={soilInputs.potassium} 
                        onChange={(e) => updateSoilField('potassium', e.target.value)}
                      />
                    </label>
                    <label>
                      Moisture (%)
                      <input 
                        type="number" 
                        min="0"
                        max="100"
                        value={soilInputs.moisture} 
                        onChange={(e) => updateSoilField('moisture', e.target.value)}
                      />
                    </label>
                    <label>
                      Temperature (°C)
                      <input 
                        type="number" 
                        min="-10"
                        max="60"
                        value={soilInputs.temperature} 
                        onChange={(e) => updateSoilField('temperature', e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="col-actions">
                    <button 
                      className="btn analyze" 
                      onClick={() => analyzeSoil()}
                      title="Analyze soil composition"
                    >
                      🔬 Analyze Soil
                    </button>
                    <button 
                      className="btn predict" 
                      onClick={() => predictCrop()}
                      title="Get crop recommendations"
                    >
                      🌾 Predict Crops
                    </button>
                  </div>

                  <div className="col-results">
                    {analysisResult ? (
                      <div className="soil-result">
                        <h4>📊 Analysis Results</h4>
                        <ul>
                          {analysisResult.map((m, i) => <li key={i}>{m}</li>)}
                        </ul>
                      </div>
                    ) : (
                      <p className="muted">No analysis yet. Enter soil values and click "Analyze Soil".</p>
                    )}
                    
                    {predictionResult && (
                      <div className="prediction-result">
                        <h4>🌱 Recommended Crops</h4>
                        <ul>
                          {predictionResult.map((c, i) => (
                            <li key={i}>
                              <span className="crop-initial" aria-hidden>
                                {String(c).substring(0, 1)}
                              </span>
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <SoilGauges soil={soilInputs} />
              <div style={{display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
                <div style={{flex: '1 1 400px'}}>
                  <QuickStats 
                    analyses={history.filter(h => h.type === 'analysis')} 
                    predictions={[predictionResult || []]} 
                  />
                </div>
                <div style={{flex: '0 1 300px'}}>
                  <WeatherWidget />
                </div>
              </div>
            </div>
          </div>
        )}

        {role === 'admin' && previewUser && (
          <div className="user-panel preview">
            <div className="preview-header">
              {users.length > 0 ? (
                (() => {
                  const filtered = previewRole 
                    ? users.filter(u => u.role === previewRole) 
                    : users.filter(u => !u.role || u.role === 'user');
                  const first = filtered[0];
                  return (
                    <select 
                      value={selectedPreviewUserId || (first ? (first.id || first.phone) : '')} 
                      onChange={(e) => setSelectedPreviewUserId(e.target.value)}
                      className="preview-select"
                    >
                      {filtered.map(u => (
                        <option key={u.id || u.phone} value={(u.id || u.phone)}>
                          {u.firstName} {u.lastName || ''} ({u.phone || '-'})
                        </option>
                      ))}
                    </select>
                  );
                })()
              ) : (
                <span>
                  Previewing as {previewRole === 'student' ? 'student' : previewRole === 'analyst' ? 'analyst' : 'farmer'}: {users.length > 0 ? users[0].firstName : 'Preview'}
                </span>
              )}

              <div className="preview-controls">
                <div className="profile-dropdown-wrapper" ref={profileRef}>
                  <button 
                    className={`btn-profile ${showProfile ? 'active' : ''}`} 
                    onClick={toggleProfile}
                    title="View profile"
                  >
                    {showProfile ? 'Hide Profile' : '👤 Profile'}
                  </button>
                  {showProfile && (
                    <div className="profile-dropdown">
                      <div className="user-card">
                        <h4>{previewProfileData.firstName} {previewProfileData.lastName || ''}</h4>
                        <div className="profile-info">
                          <div className="profile-row">
                            <span className="profile-label">📧 Email:</span>
                            <span>{previewProfileData.email || '-'}</span>
                          </div>
                          <div className="profile-row">
                            <span className="profile-label">📱 Phone:</span>
                            <span>{previewProfileData.phone || '-'}</span>
                          </div>
                          {previewProfileData.address && (
                            <div className="profile-row">
                              <span className="profile-label">🏠 Address:</span>
                              <span>{previewProfileData.address}</span>
                            </div>
                          )}
                          {previewProfileData.city && (
                            <div className="profile-row">
                              <span className="profile-label">🌆 City:</span>
                              <span>{previewProfileData.city}</span>
                            </div>
                          )}
                          {previewProfileData.state && (
                            <div className="profile-row">
                              <span className="profile-label">📍 State:</span>
                              <span>{previewProfileData.state}</span>
                            </div>
                          )}
                          {previewProfileData.zipCode && (
                            <div className="profile-row">
                              <span className="profile-label">📮 Zip:</span>
                              <span>{previewProfileData.zipCode}</span>
                            </div>
                          )}
                          {previewProfileData.country && (
                            <div className="profile-row">
                              <span className="profile-label">🌍 Country:</span>
                              <span>{previewProfileData.country}</span>
                            </div>
                          )}
                          {previewProfileData.bio && (
                            <div className="profile-row">
                              <span className="profile-label">ℹ️ Bio:</span>
                              <span>{previewProfileData.bio}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {!previewRole && (
                  <div className="history-dropdown-wrapper" ref={historyRef}>
                    <button 
                      className={`btn history-btn ${showHistory ? 'active' : ''}`} 
                      onClick={toggleHistory}
                      title="View history"
                    >
                      {showHistory ? 'Hide History' : '📜 History'}
                    </button>
                    {showHistory && (
                      <div className="history-dropdown">
                        <div className="history-actions">
                          <button 
                            className="btn-clear" 
                            onClick={clearHistory}
                            disabled={history.length === 0}
                            title="Clear all history"
                          >
                            🗑️ Clear History
                          </button>
                        </div>
                        {history.length === 0 ? (
                          <p className="empty-state">No history for this farmer.</p>
                        ) : (
                          <ul className="history-list">
                            {history.map(h => (
                              <li key={h.id} className="history-entry">
                                <div className="history-meta">
                                  {h.type === 'analysis' ? '🔬' : '🌾'} {h.type} • {new Date(h.ts).toLocaleString()}
                                </div>
                                <div className="history-summary">
                                  {Array.isArray(h.result) ? h.result.join(', ') : String(h.result)}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {previewRole === 'student' ? (
              <div style={{ width: '100%' }}>
                <StudentDashboard 
                  history={history} 
                  analyses={[]} 
                  onDatasetLoaded={() => setStudentDatasetLoaded(true)}
                  clearDatasetTrigger={studentClearCounter}
                />
              </div>
            ) : previewRole === 'analyst' ? (
              <div style={{ width: '100%' }}>
                <AnalystDashboard 
                  onDatasetLoaded={() => setAnalystDatasetLoaded(true)}
                  clearDatasetTrigger={analystClearCounter}
                />
              </div>
            ) : (
              <>
                <div className="soil-section">
                  <div className="section-header">
                    <h3>🌱 Soil Analysis & Crop Prediction</h3>
                    <button 
                      className="btn-export" 
                      onClick={exportResults}
                      title="Export results"
                      disabled={!analysisResult && !predictionResult}
                    >
                      📥 Export Results
                    </button>
                  </div>

                  <div className="soil-grid">
                    <div className="soil-three-col">
                      <div className="col-inputs">
                        <label>
                          pH
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0"
                            max="14"
                            value={soilInputs.ph} 
                            onChange={(e) => updateSoilField('ph', e.target.value)}
                          />
                        </label>
                        <label>
                          N (Nitrogen)
                          <input 
                            type="number" 
                            min="0"
                            max="200"
                            value={soilInputs.nitrogen} 
                            onChange={(e) => updateSoilField('nitrogen', e.target.value)}
                          />
                        </label>
                        <label>
                          P (Phosphorus)
                          <input 
                            type="number" 
                            min="0"
                            max="200"
                            value={soilInputs.phosphorus} 
                            onChange={(e) => updateSoilField('phosphorus', e.target.value)}
                          />
                        </label>
                        <label>
                          K (Potassium)
                          <input 
                            type="number" 
                            min="0"
                            max="200"
                            value={soilInputs.potassium} 
                            onChange={(e) => updateSoilField('potassium', e.target.value)}
                          />
                        </label>
                        <label>
                          Moisture (%)
                          <input 
                            type="number" 
                            min="0"
                            max="100"
                            value={soilInputs.moisture} 
                            onChange={(e) => updateSoilField('moisture', e.target.value)}
                          />
                        </label>
                        <label>
                          Temperature (°C)
                          <input 
                            type="number" 
                            min="-10"
                            max="60"
                            value={soilInputs.temperature} 
                            onChange={(e) => updateSoilField('temperature', e.target.value)}
                          />
                        </label>
                      </div>

                      <div className="col-actions">
                        <button className="btn analyze" onClick={() => analyzeSoil()}>
                          🔬 Analyze Soil
                        </button>
                        <button className="btn predict" onClick={() => predictCrop()}>
                          🌾 Predict Crops
                        </button>
                      </div>

                      <div className="col-results">
                        {analysisResult ? (
                          <div className="soil-result">
                            <h4>📊 Analysis Results</h4>
                            <ul>
                              {analysisResult.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                          </div>
                        ) : (
                          <p className="muted">No analysis yet.</p>
                        )}
                        
                        {predictionResult && (
                          <div className="prediction-result">
                            <h4>🌱 Recommended Crops</h4>
                            <ul>
                              {predictionResult.map((c, i) => (
                                <li key={i}>
                                  <span className="crop-initial" aria-hidden>{String(c).substring(0, 1)}</span>
                                  {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                  <SoilGauges soil={soilInputs} />
                  <div style={{display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
                    <div style={{flex: '1 1 400px'}}>
                      <QuickStats analyses={history.filter(h => h.type === 'analysis')} predictions={[predictionResult || []]} />
                    </div>
                    <div style={{flex: '0 1 300px'}}>
                      <WeatherWidget />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {modal && <CenteredModal {...modal} onClose={() => setModal(null)} />}
    </div>
  );
}
 

