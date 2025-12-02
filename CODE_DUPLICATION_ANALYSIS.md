# Duplicate Code Analysis Report
## Farmers Friends Project - Code Duplication Findings

**Analysis Date**: December 1, 2025  
**Scope**: Complete project codebase (client + server)

---

## 🔍 Executive Summary

### Duplication Statistics
- **Critical Duplications**: 8 major instances
- **Minor Duplications**: 15+ instances
- **Refactoring Priority**: HIGH for API_BASE, Medium for utility functions
- **Estimated Lines of Duplicated Code**: ~200-300 lines
- **Potential Code Reduction**: 30-40%

---

## 🚨 Critical Duplications (PRIORITY: HIGH)

### 1. **API_BASE Configuration** ⚠️ HIGHEST PRIORITY
**Duplicated Across 7 Files:**

```javascript
// DUPLICATED CODE (appears in all these files):
const API_BASE = (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/$/, '') : '') || '/api';
```

**Files Affected:**
1. `/client/src/pages/Dashboard.js` (Line 12)
2. `/client/src/pages/AdminUsersPage.js` (Line 5)
3. `/client/src/pages/AdminRolePage.js` (Line 5)
4. `/client/src/pages/AdminDatasetsPage.js` (Line 4)
5. `/client/src/pages/SignUpPage.js` (Line 7)
6. `/client/src/pages/VerifyOtpPage.js` (Line 7)
7. `/client/src/pages/RealLoginPage.js` (Line 7)

**Impact**: 
- Maintenance nightmare (7 places to update)
- Inconsistent configuration risk
- Code bloat (7 identical lines)

**Recommendation**: 
Create `/client/src/utils/api.js` or `/client/src/config/api.js`

```javascript
// NEW FILE: /client/src/config/api.js
export const API_BASE = (process.env.REACT_APP_API_URL 
  ? process.env.REACT_APP_API_URL.replace(/\/$/, '') 
  : '') || '/api';

export const apiRequest = async (endpoint, options = {}) => {
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  return response.json();
};
```

Then import:
```javascript
import { API_BASE } from '../config/api';
```

**Estimated Effort**: 30 minutes  
**Risk Level**: Low (simple refactor)  
**Code Reduction**: 6 lines

---

### 2. **fetchUsers() Function** ⚠️ HIGH PRIORITY
**Duplicated Across 3 Files:**

```javascript
// DUPLICATED in Dashboard.js (Lines 214-226)
const fetchUsers = useCallback(async () => {
  setLoading(true);
  try { 
    const res = await fetch(`${API_BASE}/users`); 
    const json = await res.json(); 
    setUsers(json || []); 
  }
  catch (err) { 
    console.error(err); 
    setUsers([]); 
  }
  finally { 
    setLoading(false); 
  }
}, []);

// DUPLICATED in AdminUsersPage.js (Lines 14-19)
async function fetchUsers() {
  setLoading(true);
  try { const res = await fetch(`${API_BASE}/users`); const json = await res.json(); setUsers(json || []); }
  catch (err) { console.error(err); setUsers([]); }
  finally { setLoading(false); }
}

// DUPLICATED (with filtering) in AdminRolePage.js (Lines 15-33)
async function fetchUsers() {
  setLoading(true);
  try {
    const res = await fetch(`${API_BASE}/users`);
    const json = await res.json();
    if (!Array.isArray(json)) setUsers([]);
    else {
      const r = (role || 'all').toLowerCase();
      const filtered = (r === 'all' || r === 'users' || r === 'user') 
        ? json 
        : json.filter(u => String(u.role || '').toLowerCase() === r);
      setUsers(filtered);
    }
  } catch (err) {
    console.error(err);
    setUsers([]);
  } finally { setLoading(false); }
}
```

**Files Affected:**
1. `/client/src/pages/Dashboard.js`
2. `/client/src/pages/AdminUsersPage.js`
3. `/client/src/pages/AdminRolePage.js`

**Impact**:
- ~45 lines of duplicate logic
- Inconsistent error handling
- Hard to maintain/update

**Recommendation**: 
Create custom React hook

```javascript
// NEW FILE: /client/src/hooks/useUsers.js
import { useState, useCallback } from 'react';
import { API_BASE } from '../config/api';

export const useUsers = (role = null) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/users`);
      const json = await res.json();
      
      if (!Array.isArray(json)) {
        setUsers([]);
        return;
      }

      // Optional role filtering
      if (role && role !== 'all') {
        const filtered = json.filter(u => 
          String(u.role || '').toLowerCase() === role.toLowerCase()
        );
        setUsers(filtered);
      } else {
        setUsers(json);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  return { users, setUsers, loading, error, fetchUsers };
};
```

Usage:
```javascript
// In any component:
const { users, loading, error, fetchUsers } = useUsers('student');
```

**Estimated Effort**: 1 hour  
**Risk Level**: Medium (requires testing)  
**Code Reduction**: 40+ lines

---

### 3. **fetchDatasets() Function** ⚠️ HIGH PRIORITY
**Duplicated Across 2 Files:**

```javascript
// DUPLICATED in Dashboard.js (Lines 249-256)
const fetchDatasets = useCallback(async () => { 
  try { 
    const res = await fetch(`${API_BASE}/admin/datasets`); 
    const json = await res.json(); 
    setDatasets(json || []); 
  } catch (err) { 
    console.error(err); 
    setDatasets([]); 
  }
}, []);

// DUPLICATED in AdminDatasetsPage.js (Line 15)
async function fetchDatasets() { 
  try { 
    const res = await fetch(`${API_BASE}/admin/datasets`); 
    const json = await res.json(); 
    setDatasets(json || []); 
  } catch (err) { 
    console.error(err); 
    setDatasets([]); 
  } 
}
```

**Files Affected:**
1. `/client/src/pages/Dashboard.js`
2. `/client/src/pages/AdminDatasetsPage.js`

**Recommendation**: 
Create custom hook

```javascript
// NEW FILE: /client/src/hooks/useDatasets.js
import { useState, useCallback } from 'react';
import { API_BASE } from '../config/api';

export const useDatasets = () => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/datasets`);
      const json = await res.json();
      setDatasets(json || []);
    } catch (err) {
      console.error('Error fetching datasets:', err);
      setError(err.message);
      setDatasets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { datasets, setDatasets, loading, error, fetchDatasets };
};
```

**Estimated Effort**: 30 minutes  
**Risk Level**: Low  
**Code Reduction**: 20+ lines

---

### 4. **toggleUser() Function** 
**Duplicated Across 2 Files:**

```javascript
// DUPLICATED in Dashboard.js (Lines 231-242)
const toggleUser = useCallback(async (userId) => {
  try {
    const res = await fetch(`${API_BASE}/users/${userId}/toggle`, { method: 'PATCH' });
    const json = await res.json();
    if (!res.ok) return setModal({ title: 'Error', message: json.error || 'Failed' });
    setUsers(prev => prev.map(u => u.id === userId ? json.user : u));
    setModal({ title: 'Success', message: `User ${json.user.active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    console.error(err);
    setModal({ title: 'Error', message: 'Server error' });
  }
}, []);

// DUPLICATED in AdminUsersPage.js (Lines 21-28)
async function toggleUser(userId) {
  try {
    const res = await fetch(`${API_BASE}/users/${userId}/toggle`, { method: 'PATCH' });
    const json = await res.json();
    if (res.ok) setUsers(prev => prev.map(u => u.id === userId ? json.user : u));
    else alert(json.error || 'Failed to toggle');
  } catch (err) { console.error(err); alert('Server error'); }
}
```

**Files Affected:**
1. `/client/src/pages/Dashboard.js`
2. `/client/src/pages/AdminUsersPage.js`

**Recommendation**:
Add to `useUsers` hook

```javascript
// Add to useUsers.js hook:
const toggleUser = useCallback(async (userId) => {
  try {
    const res = await fetch(`${API_BASE}/users/${userId}/toggle`, { 
      method: 'PATCH' 
    });
    const json = await res.json();
    
    if (!res.ok) {
      throw new Error(json.error || 'Failed to toggle user');
    }
    
    // Update local state
    setUsers(prev => prev.map(u => 
      u.id === userId ? json.user : u
    ));
    
    return json.user;
  } catch (err) {
    console.error('Error toggling user:', err);
    setError(err.message);
    throw err;
  }
}, []);

return { users, setUsers, loading, error, fetchUsers, toggleUser };
```

**Estimated Effort**: 20 minutes  
**Risk Level**: Low

---

### 5. **Dataset Management Functions** 
**Duplicated Across 2 Files:**

#### **uploadDataset()**
```javascript
// Dashboard.js (Lines 565-587)
const uploadDataset = useCallback(async () => {
  if (!uploadFile) return setModal({ title: 'Error', message: 'Choose a file first' });
  setUploading(true);
  try {
    const resp = await fetch(`${API_BASE}/admin/dataset?filename=${encodeURIComponent(uploadFile.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: await uploadFile.arrayBuffer()
    });
    const json = await resp.json();
    if (!resp.ok) return setModal({ title: 'Error', message: json.error || 'Upload failed' });
    setModal({ title: 'Success', message: `Uploaded: ${json.file}` });
    setUploadFile(null);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
    await fetchDatasets();
  } catch (err) {
    console.error(err);
    setModal({ title: 'Error', message: 'Upload error' });
  } finally {
    setUploading(false);
  }
}, [uploadFile, fetchDatasets]);

// AdminDatasetsPage.js (Lines 19-31) - NEARLY IDENTICAL
```

#### **importDataset()**
```javascript
// Dashboard.js (Lines 597-611)
const importDataset = useCallback(async (name) => {
  if (!window.confirm(`Import dataset ${name}?`)) return;
  try {
    const resp = await fetch(`${API_BASE}/admin/datasets/${encodeURIComponent(name)}/import`, { method: 'POST' });
    const json = await resp.json();
    if (!resp.ok) return setModal({ title: 'Error', message: json.error || 'Import failed' });
    setModal({ title: 'Success', message: 'Dataset imported' });
    fetchUsers();
  } catch (err) {
    console.error(err);
    setModal({ title: 'Error', message: 'Import error' });
  }
}, [fetchUsers]);

// AdminDatasetsPage.js (Line 34) - NEARLY IDENTICAL
```

#### **deleteDataset()**
```javascript
// Dashboard.js (Lines 621-635)
const deleteDataset = useCallback(async (name) => {
  if (!window.confirm(`Delete dataset ${name}?`)) return;
  try {
    const resp = await fetch(`${API_BASE}/admin/dataset?file=${encodeURIComponent(name)}`, { method: 'DELETE' });
    const json = await resp.json();
    if (!resp.ok) return setModal({ title: 'Error', message: json.error || 'Delete failed' });
    setModal({ title: 'Success', message: 'Dataset deleted' });
    setDatasets(prev => prev.filter(d => (typeof d === 'string' ? d : d.file) !== name));
  } catch (err) {
    console.error(err);
    setModal({ title: 'Error', message: 'Delete error' });
  }
}, []);

// AdminDatasetsPage.js (Line 36) - NEARLY IDENTICAL
```

**Files Affected:**
1. `/client/src/pages/Dashboard.js`
2. `/client/src/pages/AdminDatasetsPage.js`

**Recommendation**:
Extend `useDatasets` hook with CRUD operations

```javascript
// Enhanced useDatasets.js
export const useDatasets = () => {
  // ... existing code ...

  const uploadDataset = useCallback(async (file) => {
    if (!file) throw new Error('No file selected');
    
    setLoading(true);
    try {
      const resp = await fetch(
        `${API_BASE}/admin/dataset?filename=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: await file.arrayBuffer()
        }
      );
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Upload failed');
      
      await fetchDatasets(); // Refresh list
      return json;
    } finally {
      setLoading(false);
    }
  }, [fetchDatasets]);

  const importDataset = useCallback(async (name) => {
    const resp = await fetch(
      `${API_BASE}/admin/datasets/${encodeURIComponent(name)}/import`,
      { method: 'POST' }
    );
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || 'Import failed');
    return json;
  }, []);

  const deleteDataset = useCallback(async (name) => {
    const resp = await fetch(
      `${API_BASE}/admin/dataset?file=${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    );
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || 'Delete failed');
    
    setDatasets(prev => prev.filter(d => 
      (typeof d === 'string' ? d : d.file) !== name
    ));
    return json;
  }, []);

  return { 
    datasets, 
    setDatasets, 
    loading, 
    error, 
    fetchDatasets,
    uploadDataset,
    importDataset,
    deleteDataset
  };
};
```

**Estimated Effort**: 1 hour  
**Risk Level**: Medium  
**Code Reduction**: 60+ lines

---

## 📝 Minor Duplications (PRIORITY: MEDIUM)

### 6. **Utility Functions** 
**Only used in Dashboard.js but could be extracted:**

```javascript
// Dashboard.js (Lines 15-28)
const deriveNameFromEmail = (email) => {
  if (!email) return null;
  const local = String(email).split('@')[0];
  const spaced = local.replace(/[._\-+]+/g, ' ');
  return spaced.split(' ').map(s => s ? (s[0].toUpperCase() + s.slice(1)) : '').join(' ').trim();
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
```

**Recommendation**:
Create `/client/src/utils/formatters.js`

```javascript
// NEW FILE: /client/src/utils/formatters.js
export const deriveNameFromEmail = (email) => {
  if (!email) return null;
  const local = String(email).split('@')[0];
  const spaced = local.replace(/[._\-+]+/g, ' ');
  return spaced
    .split(' ')
    .map(s => s ? (s[0].toUpperCase() + s.slice(1)) : '')
    .join(' ')
    .trim();
};

export const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const formatDate = (date) => {
  return new Date(date).toLocaleString();
};
```

**Estimated Effort**: 15 minutes  
**Risk Level**: Very Low

---

### 7. **Loading States & Error Handling Patterns**
**Repeated pattern across multiple files:**

```javascript
// Common pattern (appears 10+ times):
try {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) return alert(json.error || 'Failed');
  // success
} catch (err) {
  console.error(err);
  alert('Error');
}
```

**Recommendation**:
Create error handling utility

```javascript
// NEW FILE: /client/src/utils/errorHandler.js
export const handleApiError = (err, defaultMessage = 'An error occurred') => {
  console.error(err);
  return err.message || defaultMessage;
};

export const fetchWithErrorHandling = async (url, options = {}) => {
  try {
    const res = await fetch(url, options);
    const json = await res.json();
    
    if (!res.ok) {
      throw new Error(json.error || 'Request failed');
    }
    
    return { success: true, data: json };
  } catch (err) {
    return { success: false, error: handleApiError(err) };
  }
};
```

**Estimated Effort**: 30 minutes  
**Risk Level**: Low

---

### 8. **User Table Rendering**
**Similar table structure in 3 files:**

Files:
- Dashboard.js (Lines 1280-1384)
- AdminUsersPage.js (Lines 43-56)
- AdminRolePage.js (Lines 41-53)

**Recommendation**:
Create reusable `<UserTable>` component

```javascript
// NEW FILE: /client/src/components/UserTable.js
import React from 'react';

export const UserTable = ({ 
  users, 
  loading, 
  showRole = false,
  showActions = true,
  onToggleUser 
}) => {
  if (loading) return <p>Loading users...</p>;
  
  return (
    <table className="users-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Phone</th>
          <th>Email</th>
          {showRole && <th>Role</th>}
          <th>Status</th>
          {showActions && <th>Action</th>}
        </tr>
      </thead>
      <tbody>
        {users.length === 0 ? (
          <tr><td colSpan={showRole ? 6 : 5}>No users found</td></tr>
        ) : (
          users.map(u => (
            <tr key={u.id || u.phone}>
              <td>{u.firstName} {u.lastName || ''}</td>
              <td>{u.phone}</td>
              <td>{u.email || '-'}</td>
              {showRole && <td>{u.role || '-'}</td>}
              <td>
                <span className={`status ${u.active ? 'green' : 'red'}`}>
                  {u.active ? '✓ Active' : '○ Passive'}
                </span>
              </td>
              {showActions && (
                <td>
                  <button 
                    className="toggle-btn" 
                    onClick={() => onToggleUser(u.id)}
                  >
                    {u.active ? 'Set Passive' : 'Set Active'}
                  </button>
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
};
```

**Estimated Effort**: 45 minutes  
**Risk Level**: Low  
**Code Reduction**: 100+ lines

---

## 📊 Duplication Summary Table

| Item | Files Affected | Lines Duplicated | Priority | Effort | Risk |
|------|---------------|------------------|----------|--------|------|
| API_BASE constant | 7 | 7 | HIGH | 30 min | Low |
| fetchUsers() | 3 | 45 | HIGH | 1 hour | Med |
| fetchDatasets() | 2 | 20 | HIGH | 30 min | Low |
| toggleUser() | 2 | 25 | HIGH | 20 min | Low |
| Dataset CRUD | 2 | 60 | HIGH | 1 hour | Med |
| Utility functions | 1 | 15 | MED | 15 min | Low |
| Error handling | 10+ | ~50 | MED | 30 min | Low |
| User table UI | 3 | 100+ | MED | 45 min | Low |

**Total Estimated Refactoring Time**: 4-5 hours  
**Total Code Reduction**: 300+ lines (15-20%)

---

## 🎯 Recommended Refactoring Plan

### Phase 1: Configuration & Utilities (1 hour) ✅ LOW RISK
1. Create `/client/src/config/api.js` with API_BASE
2. Create `/client/src/utils/formatters.js` with utility functions
3. Create `/client/src/utils/errorHandler.js` with error handling
4. Update all imports

### Phase 2: Custom Hooks (2 hours) ⚠️ MEDIUM RISK
1. Create `/client/src/hooks/useUsers.js`
2. Create `/client/src/hooks/useDatasets.js`
3. Test hooks thoroughly
4. Migrate Dashboard.js to use hooks
5. Migrate Admin pages to use hooks

### Phase 3: Reusable Components (1 hour) ✅ LOW RISK
1. Create `/client/src/components/UserTable.js`
2. Migrate all table instances
3. Test rendering

### Phase 4: Testing & Verification (1 hour)
1. Manual testing of all admin functions
2. Test user management
3. Test dataset operations
4. Verify error handling

---

## 🔧 Proposed File Structure

```
client/src/
├── config/
│   └── api.js                 # NEW: API configuration
├── hooks/
│   ├── useUsers.js           # NEW: User management hook
│   └── useDatasets.js        # NEW: Dataset management hook
├── utils/
│   ├── formatters.js         # NEW: Formatting utilities
│   └── errorHandler.js       # NEW: Error handling
├── components/
│   ├── UserTable.js          # NEW: Reusable user table
│   ├── BackButton.js         # EXISTING
│   ├── CenteredModal.js      # EXISTING
│   └── ...
└── pages/
    ├── Dashboard.js          # REFACTOR: Use hooks
    ├── AdminUsersPage.js     # REFACTOR: Use hooks
    ├── AdminRolePage.js      # REFACTOR: Use hooks
    ├── AdminDatasetsPage.js  # REFACTOR: Use hooks
    └── ...
```

---

## ⚡ Quick Wins (Can implement immediately)

### 1. Extract API_BASE (5 minutes each file)
```bash
# Create config file
echo "export const API_BASE = ..." > src/config/api.js

# Replace in each file
import { API_BASE } from '../config/api';
```

### 2. Extract formatters (10 minutes)
- Move to utils/formatters.js
- Import where needed

### 3. DRY principle for fetch calls
- Consider using axios or creating fetch wrapper

---

## 🎯 Benefits of Refactoring

### Code Quality
- ✅ Single source of truth for API config
- ✅ Reusable hooks across components
- ✅ Consistent error handling
- ✅ Easier to test

### Maintenance
- ✅ Update logic in one place
- ✅ Reduce bugs from inconsistent implementations
- ✅ Easier onboarding for new developers

### Performance
- ✅ Shared hooks can use React.memo
- ✅ Reduced bundle size (slightly)

### Future-Proofing
- ✅ Easy to add caching
- ✅ Easy to add request interceptors
- ✅ Easy to migrate to React Query/SWR

---

## 📋 Conclusion

The project has **significant code duplication**, particularly around:
1. **API configuration** (7 duplicates)
2. **Data fetching logic** (5+ duplicates)
3. **CRUD operations** (4+ duplicates)

**Priority**: Address API_BASE and data fetching hooks first as they provide the most value with lowest risk.

**Recommended Action**: Implement Phase 1 immediately (1 hour investment, high return).

