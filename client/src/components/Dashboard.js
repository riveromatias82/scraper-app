import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Plus, 
  ExternalLink, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import ConfirmationDialog from './ConfirmationDialog';

const Dashboard = () => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scrapingLoading, setScrapingLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [isFastPolling, setIsFastPolling] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, pageId: null });
  const pollingIntervalRef = useRef(null);
  const notifiedPagesRef = useRef(new Set());
  const statusUpdateTimeoutRef = useRef(null);

  const fetchPages = async (page = 1) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/pages?page=${page}&limit=10`);
      
      // Preserve temporary records when refreshing from server
      const temporaryPages = pages.filter(page => page.isTemporary);
      const serverPages = response.data.pages;
      
      // Merge temporary pages with server pages, prioritizing server data for matching IDs
      const mergedPages = [...temporaryPages];
      serverPages.forEach(serverPage => {
        const existingTempIndex = mergedPages.findIndex(p => p.id === serverPage.id);
        if (existingTempIndex >= 0) {
          // Merge server data with temporary record, preserving temporary data for missing fields
          const tempRecord = mergedPages[existingTempIndex];
          const updatedPage = {
            ...tempRecord, // Preserve temporary record data
            ...serverPage, // Override with server data
            // Preserve temporary title if server doesn't have one yet
            title: serverPage.title || tempRecord.title,
            // Preserve temporary URL if server doesn't have one yet
            url: serverPage.url || tempRecord.url
          };
          
          // Ensure status is immediately updated from server
          if (serverPage.status) {
            updatedPage.status = serverPage.status;
          }
          
          mergedPages[existingTempIndex] = updatedPage;
        } else {
          // Add new server page
          mergedPages.push(serverPage);
        }
      });
      
      setPages(mergedPages);
      setCurrentPage(response.data.pagination.currentPage);
      setTotalPages(response.data.pagination.totalPages);
      setTotalItems(response.data.pagination.totalItems);
      
      // Load notified pages from localStorage instead of clearing
      const savedNotifications = localStorage.getItem('notifiedPages');
      if (savedNotifications) {
        notifiedPagesRef.current = new Set(JSON.parse(savedNotifications));
      }
      
      // Check if we need to start polling after fetching pages
      const hasProcessing = mergedPages.some(page => 
        page.status === 'PENDING' || 
        page.status === 'PROCESSING' ||
        (page.isTemporary && (page.status === 'PENDING' || page.status === 'PROCESSING'))
      );
      
      // Always ensure polling is in the correct state after fetching
      if (hasProcessing) {
        if (!pollingIntervalRef.current) {
          startPolling();
        }
      } else {
        if (pollingIntervalRef.current) {
          stopPolling();
        }
      }
    } catch (error) {
      // Don't show "Failed to fetch pages" error for authentication errors
      // The AuthContext will handle session expiration and show appropriate message
      if (error.response?.status !== 401) {
        toast.error('Failed to fetch pages');
        console.error('Error fetching pages:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if there are any pages still processing
  const hasProcessingPages = () => {
    return pages.some(page => 
      page.status === 'PENDING' || 
      page.status === 'PROCESSING' ||
      (page.isTemporary && (page.status === 'PENDING' || page.status === 'PROCESSING'))
    );
  };

  // Start polling for status updates
  const startPolling = (fastMode = false) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    const interval = fastMode ? 500 : 2000; // Fast mode: 500ms, normal mode: 2s
    setIsFastPolling(fastMode);
    
    pollingIntervalRef.current = setInterval(() => {
      if (hasProcessingPages()) {
        fetchPages(currentPage);
        
        // Switch to normal polling after 5 seconds of fast polling
        if (fastMode && pollingIntervalRef.current) {
          setTimeout(() => {
            if (hasProcessingPages()) {
              startPolling(false); // Switch to normal polling
            }
          }, 5000);
        }
      } else {
        // Stop polling if no pages are processing
        stopPolling();
      }
    }, interval);
  };

  // Start fast polling for immediate status updates
  const startFastPolling = () => {
    startPolling(true);
  };

  // Stop polling
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsFastPolling(false);
  };

  // Clear notification history
  const clearNotificationHistory = () => {
    notifiedPagesRef.current.clear();
    localStorage.removeItem('notifiedPages');
  };

  // Initialize notifications from localStorage on component mount
  useEffect(() => {
    const savedNotifications = localStorage.getItem('notifiedPages');
    if (savedNotifications) {
      notifiedPagesRef.current = new Set(JSON.parse(savedNotifications));
    }
  }, []);

  useEffect(() => {
    fetchPages();
    
    // Start polling if there are processing pages
    return () => {
      stopPolling();
    };
  }, []);

  // Start/stop polling based on page status changes
  useEffect(() => {
    const hasProcessing = hasProcessingPages();
    if (hasProcessing) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [pages]);

  // Check for completed jobs and show notifications
  useEffect(() => {
    const checkForCompletedJobs = () => {
      let hasStatusChange = false;
      
      pages.forEach(page => {
        // Skip temporary records for notifications
        if (page.isTemporary) return;
        
        const pageKey = `${page.id}-${page.status}`;
        
        if (page.status === 'COMPLETED' && page.linkCount > 0 && !notifiedPagesRef.current.has(pageKey)) {
          // Show success notification for completed jobs
          toast.success(`Scraping completed for ${page.title || page.url}: ${page.linkCount} links found!`, {
            duration: 4000,
            id: `completed-${page.id}` // Prevent duplicate notifications
          });
          notifiedPagesRef.current.add(pageKey);
          // Save to localStorage
          localStorage.setItem('notifiedPages', JSON.stringify([...notifiedPagesRef.current]));
          hasStatusChange = true;
        } else if (page.status === 'FAILED' && !notifiedPagesRef.current.has(pageKey)) {
          // Show error notification for failed jobs
          toast.error(`Scraping failed for ${page.title || page.url}`, {
            duration: 4000,
            id: `failed-${page.id}` // Prevent duplicate notifications
          });
          notifiedPagesRef.current.add(pageKey);
          // Save to localStorage
          localStorage.setItem('notifiedPages', JSON.stringify([...notifiedPagesRef.current]));
          hasStatusChange = true;
        }
      });
      
      // If there was a status change, trigger an immediate re-render
      if (hasStatusChange) {
        // Force a re-render by updating the pages state
        setPages(prevPages => [...prevPages]);
      }
    };

    // Only check if we have pages and they're not all in initial loading state
    if (pages.length > 0 && !loading) {
      checkForCompletedJobs();
    }
  }, [pages, loading]);

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (statusUpdateTimeoutRef.current) {
        clearTimeout(statusUpdateTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    // Check for duplicate URL in current pages (case-insensitive)
    const normalizedUrl = url.trim().toLowerCase();
    const existingPage = pages.find(page => 
      page.url.toLowerCase() === normalizedUrl && !page.isTemporary
    );

    if (existingPage) {
      toast.error(
        <div>
          This URL has already been added for scraping.{' '}
          {existingPage.status === 'COMPLETED' && (
            <Link 
              to={`/page/${existingPage.id}`} 
              className="text-blue-400 hover:text-blue-300 underline"
            >
              View existing page
            </Link>
          )}
        </div>,
        { duration: 5000 }
      );
      return;
    }

    // Create a temporary record with PENDING status
    const tempId = `temp-${Date.now()}`;
    const newPage = {
      id: tempId,
      url: url.trim(),
      title: null,
      status: 'PENDING',
      linkCount: 0,
      createdAt: new Date().toISOString(),
      isTemporary: true
    };

    // Add the temporary record to the beginning of the list
    setPages(prevPages => [newPage, ...prevPages]);
    setUrl('');
    setScrapingLoading(true);

    try {
      const response = await axios.post('/api/pages', { url: url.trim() });
      
      // Update the temporary record with the real ID and PROCESSING status
      const realPage = response.data.page || response.data; // Handle both response formats
      setPages(prevPages => 
        prevPages.map(page => 
          page.id === tempId 
            ? { 
                ...page, // Preserve temporary record data (title, url, etc.)
                id: realPage.id, // Update with real ID
                status: 'PROCESSING', 
                isTemporary: false,
                // Only update server-provided fields if they exist
                ...(realPage.createdAt && { createdAt: realPage.createdAt }),
                ...(realPage.updatedAt && { updatedAt: realPage.updatedAt })
              }
            : page
        )
      );
      
      toast.success('Page added for scraping!');
      
      // Start fast polling immediately since the page is now in PROCESSING status
      if (hasProcessingPages()) {
        startFastPolling();
      }
    } catch (error) {
      // Don't show error for authentication errors - AuthContext will handle it
      if (error.response?.status === 401) {
        // Remove the temporary record since authentication failed
        setPages(prevPages => prevPages.filter(page => page.id !== tempId));
        return;
      }
      
      // Remove the temporary record entirely for duplicate URL errors
      if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
        setPages(prevPages => prevPages.filter(page => page.id !== tempId));
        toast.error(error.response.data.error);
      } else {
        // For other errors, update the temporary record to FAILED status
        setPages(prevPages => 
          prevPages.map(page => 
            page.id === tempId 
              ? { ...page, status: 'FAILED', isTemporary: false }
              : page
          )
        );
        
        const message = error.response?.data?.error || 'Failed to add page';
        toast.error(message);
      }
    } finally {
      setScrapingLoading(false);
    }
  };

  const handleDelete = async (pageId) => {
    // Find the page to check if it's temporary
    const pageToDelete = pages.find(page => page.id === pageId);
    
    // Check if the deleted page was processing
    const wasProcessing = pageToDelete && (
      pageToDelete.status === 'PENDING' || 
      pageToDelete.status === 'PROCESSING' ||
      (pageToDelete.isTemporary && (pageToDelete.status === 'PENDING' || pageToDelete.status === 'PROCESSING'))
    );
    
    // Immediately remove from local state
    setPages(prevPages => prevPages.filter(page => page.id !== pageId));

    // Only make API call for non-temporary records
    if (!pageToDelete?.isTemporary) {
      try {
        await axios.delete(`/api/pages/${pageId}`);
        toast.success('Page deleted successfully');
        
        // Refresh pagination data to update totals
        await fetchPages(currentPage);
        
        // If the deleted page was processing, ensure polling is properly managed
        if (wasProcessing) {
          // Force a check for processing pages after the fetch
          setTimeout(() => {
            if (hasProcessingPages() && !pollingIntervalRef.current) {
              startPolling();
            }
          }, 100);
        }
      } catch (error) {
        // Don't show error for authentication errors - AuthContext will handle it
        if (error.response?.status !== 401) {
          toast.error('Failed to delete page');
          // Re-add the page to the list if deletion failed
          setPages(prevPages => [...prevPages, pageToDelete]);
        }
      }
    } else {
      toast.success('Page removed');
    }
  };

  const openDeleteDialog = (pageId) => {
    setDeleteDialog({ isOpen: true, pageId });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({ isOpen: false, pageId: null });
  };

  const confirmDelete = () => {
    if (deleteDialog.pageId) {
      handleDelete(deleteDialog.pageId);
    }
  };

  const handleRetry = async (pageId) => {
    try {
      await axios.post(`/api/pages/${pageId}/retry`);
      toast.success('Retry scraping started');
      
      // Update the page status to PROCESSING immediately
      setPages(prevPages => 
        prevPages.map(page => 
          page.id === pageId 
            ? { ...page, status: 'PROCESSING' }
            : page
        )
      );
      
      // Start fast polling immediately since the retried page will be in PROCESSING status
      if (hasProcessingPages()) {
        startFastPolling();
      }
    } catch (error) {
      // Don't show error for authentication errors - AuthContext will handle it
      if (error.response?.status !== 401) {
        toast.error('Failed to retry scraping');
      }
    }
  };

  const getStatusIcon = (status) => {
    const upperStatus = status?.toUpperCase();
    const iconClasses = "h-4 w-4 transition-all duration-200 ease-in-out";
    
    switch (upperStatus) {
      case 'PENDING':
        return <Clock className={`${iconClasses} text-yellow-500`} />;
      case 'PROCESSING':
        return <Loader2 className={`${iconClasses} text-blue-500 animate-spin`} />;
      case 'COMPLETED':
        return <CheckCircle className={`${iconClasses} text-green-500`} />;
      case 'FAILED':
        return <XCircle className={`${iconClasses} text-red-500`} />;
      default:
        return <Clock className={`${iconClasses} text-gray-500`} />;
    }
  };

  // Memoized status icon component to prevent unnecessary re-renders
  const StatusIcon = React.memo(({ status }) => {
    // Force re-render when status changes to ensure immediate visual update
    return (
      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center" key={status}>
        {getStatusIcon(status)}
      </div>
    );
  }, (prevProps, nextProps) => {
    // Only re-render if status actually changes
    return prevProps.status === nextProps.status;
  });

  const getStatusText = (status) => {
    const upperStatus = status?.toUpperCase();
    switch (upperStatus) {
      case 'PENDING':
        return 'Pending';
      case 'PROCESSING':
        return 'Processing';
      case 'COMPLETED':
        return 'Completed';
      case 'FAILED':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">Manage your scraped pages and add new URLs for scraping</p>
          </div>
          {isFastPolling && (
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Monitoring status updates...</span>
            </div>
          )}
        </div>
      </div>

      {/* Add New Page Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Page</h2>
        <form onSubmit={handleSubmit} className="flex gap-4">
          <div className="flex-1">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL to scrape (e.g., https://example.com)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={scrapingLoading}
            />
          </div>
          <button
            type="submit"
            disabled={scrapingLoading || !url.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scrapingLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {scrapingLoading ? 'Adding...' : 'Scrape'}
          </button>
        </form>
      </div>

      {/* Pages List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Your Pages</h2>
          <p className="text-sm text-gray-600 mt-1">
            {totalItems + pages.filter(page => page.isTemporary).length} total pages • Showing page {currentPage} of {totalPages}
            {pages.some(page => page.isTemporary) && (
              <span className="text-yellow-600 ml-2">
                • {pages.filter(page => page.isTemporary).length} pending
              </span>
            )}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No pages found. Add a URL to get started!</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Page
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Links
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Added
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pages.map((page) => (
                    <tr key={page.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {page.title || (() => {
                              if (page.status === 'PENDING') return 'Pending...';
                              if (page.status === 'PROCESSING') return 'Processing...';
                              if (page.status === 'FAILED') return 'Failed';
                              return 'Untitled';
                            })()}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            <a 
                              href={page.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:text-primary-600 truncate max-w-xs block"
                            >
                              {page.url}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <StatusIcon key={`${page.id}-${page.status}`} status={page.status} />
                          <span className="text-sm text-gray-900 flex-shrink-0">
                            {getStatusText(page.status)}
                          </span>
                          {(page.status === 'PENDING' || page.status === 'PROCESSING') && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0" title="Checking for updates..."></div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {page.linkCount} links
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(page.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {page.status === 'COMPLETED' && !page.isTemporary && (
                            <Link
                              to={`/page/${page.id}`}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              View Links
                            </Link>
                          )}
                          {page.status === 'FAILED' && !page.isTemporary && (
                            <button
                              onClick={() => handleRetry(page.id)}
                              className="text-yellow-600 hover:text-yellow-900 flex items-center gap-1"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry
                            </button>
                          )}
                          <button
                            onClick={() => openDeleteDialog(page.id)}
                            className="text-red-600 hover:text-red-900 flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing page {currentPage} of {totalPages}
                    {pages.some(page => page.isTemporary) && (
                      <span className="text-gray-500 ml-2">
                        • {pages.filter(page => page.isTemporary).length} pending
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchPages(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchPages(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
        title="Delete Page"
        message="Are you sure you want to delete this page? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default Dashboard;
