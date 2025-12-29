import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Connections from './pages/Connections';
import SchemaViewer from './pages/SchemaViewer';
import SchemaViewerAdvanced from './pages/SchemaViewerAdvanced';
import SQLAnalyzer from './pages/SQLAnalyzer';
import TableSelectorView from './pages/TableSelectorView';
import QueryBuilder from './pages/QueryBuilder';
import AIQuery from './pages/AIQuery';
import Settings from './pages/Settings';
import Monitoring from './pages/Monitoring';
import Wiki from './pages/Wiki';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/connections" element={<Connections />} />
                    <Route path="/schema/:connId" element={<SchemaViewer />} />
                    <Route path="/schema/:connId/advanced" element={<SchemaViewerAdvanced />} />
                    <Route path="/schema/:connId/analyzer" element={<SQLAnalyzer />} />
                    <Route path="/schema/:connId/table" element={<TableSelectorView />} />
                    <Route path="/schema/:connId/query-builder" element={<QueryBuilder />} />
                    <Route path="/schema/:connId/ai-query" element={<AIQuery />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/monitoring/:connId" element={<Monitoring />} />
                    <Route path="/wiki" element={<Wiki />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;


