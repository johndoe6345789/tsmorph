import React, { useState, useEffect, useCallback } from 'react';

/**
 * BEFORE REFACTORING: Large Monolithic Component (~200+ LOC)
 * This component handles user management with forms, tables, and API calls
 * all in one file - a common anti-pattern that needs refactoring
 */

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  status: 'active' | 'inactive';
  createdAt: string;
}

interface FormData {
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
}

interface ValidationErrors {
  name?: string;
  email?: string;
  role?: string;
}

export const UserManagementDashboard: React.FC = () => {
  // State management
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof User>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    role: 'user',
  });
  const [formErrors, setFormErrors] = useState<ValidationErrors>({});

  // Validation logic
  const validateForm = (data: FormData): ValidationErrors => {
    const errors: ValidationErrors = {};
    
    if (!data.name.trim()) {
      errors.name = 'Name is required';
    } else if (data.name.length < 2) {
      errors.name = 'Name must be at least 2 characters';
    } else if (data.name.length > 50) {
      errors.name = 'Name must be less than 50 characters';
    }
    
    if (!data.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!data.role) {
      errors.role = 'Role is required';
    }
    
    return errors;
  };

  // API simulation functions
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 500));
      const mockUsers: User[] = [
        {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'admin',
          status: 'active',
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          id: '2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          role: 'user',
          status: 'active',
          createdAt: '2024-02-20T14:30:00Z',
        },
        {
          id: '3',
          name: 'Bob Johnson',
          email: 'bob@example.com',
          role: 'guest',
          status: 'inactive',
          createdAt: '2024-03-10T09:15:00Z',
        },
      ];
      setUsers(mockUsers);
    } catch (err) {
      setError('Failed to fetch users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Form handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (formErrors[name as keyof ValidationErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);
    try {
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (editingUser) {
        // Update existing user
        setUsers(prev => prev.map(user => 
          user.id === editingUser.id 
            ? { ...user, ...formData }
            : user
        ));
      } else {
        // Add new user
        const newUser: User = {
          id: Date.now().toString(),
          ...formData,
          status: 'active',
          createdAt: new Date().toISOString(),
        };
        setUsers(prev => [...prev, newUser]);
      }
      
      // Reset form
      setFormData({ name: '', email: '', role: 'user' });
      setShowForm(false);
      setEditingUser(null);
    } catch (err) {
      setError('Failed to save user');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setShowForm(true);
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }
    
    setLoading(true);
    try {
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 300));
      setUsers(prev => prev.filter(user => user.id !== userId));
    } catch (err) {
      setError('Failed to delete user');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filtering and sorting logic
  const filteredAndSortedUsers = users
    .filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Render helpers
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return '#ff6b6b';
      case 'user': return '#4ecdc4';
      case 'guest': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'active' ? '#2ecc71' : '#e74c3c';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>User Management Dashboard</h1>
      
      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#fee', 
          color: '#c33', 
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Search and Filter Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            flex: '1',
            minWidth: '200px'
          }}
        />
        
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
          <option value="guest">Guest</option>
        </select>

        <button
          onClick={() => {
            setShowForm(true);
            setEditingUser(null);
            setFormData({ name: '', email: '', role: 'user' });
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Add User
        </button>
      </div>

      {/* User Form */}
      {showForm && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h2>{editingUser ? 'Edit User' : 'Add New User'}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Name:
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${formErrors.name ? '#e74c3c' : '#ddd'}`,
                  borderRadius: '4px'
                }}
              />
              {formErrors.name && (
                <span style={{ color: '#e74c3c', fontSize: '14px' }}>
                  {formErrors.name}
                </span>
              )}
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Email:
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${formErrors.email ? '#e74c3c' : '#ddd'}`,
                  borderRadius: '4px'
                }}
              />
              {formErrors.email && (
                <span style={{ color: '#e74c3c', fontSize: '14px' }}>
                  {formErrors.email}
                </span>
              )}
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Role:
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="guest">Guest</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2ecc71',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                  setFormData({ name: '', email: '', role: 'user' });
                  setFormErrors({});
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div style={{ overflowX: 'auto' }}>
        {loading && users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            Loading users...
          </div>
        ) : (
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th 
                  onClick={() => handleSort('name')}
                  style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    borderBottom: '2px solid #dee2e6'
                  }}
                >
                  Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('email')}
                  style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    borderBottom: '2px solid #dee2e6'
                  }}
                >
                  Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('role')}
                  style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    borderBottom: '2px solid #dee2e6'
                  }}
                >
                  Role {sortField === 'role' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('status')}
                  style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    borderBottom: '2px solid #dee2e6'
                  }}
                >
                  Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('createdAt')}
                  style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    borderBottom: '2px solid #dee2e6'
                  }}
                >
                  Created {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left',
                  borderBottom: '2px solid #dee2e6'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ 
                    padding: '40px', 
                    textAlign: 'center',
                    color: '#7f8c8d'
                  }}>
                    No users found
                  </td>
                </tr>
              ) : (
                filteredAndSortedUsers.map(user => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px' }}>{user.name}</td>
                    <td style={{ padding: '12px' }}>{user.email}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: getRoleBadgeColor(user.role),
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: getStatusBadgeColor(user.status),
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {user.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>{formatDate(user.createdAt)}</td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => handleEdit(user)}
                        style={{
                          padding: '4px 8px',
                          marginRight: '5px',
                          backgroundColor: '#3498db',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: '20px', color: '#7f8c8d', fontSize: '14px' }}>
        Showing {filteredAndSortedUsers.length} of {users.length} users
      </div>
    </div>
  );
};

export default UserManagementDashboard;
