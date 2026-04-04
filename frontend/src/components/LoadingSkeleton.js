import React from 'react';

const LoadingSkeleton = ({ type = 'card', count = 1 }) => {
  const renderCardSkeleton = () => (
    <div className="col-sm-6 col-lg-4">
      <div className="lib-card h-100 d-flex flex-column">
        <div className="lib-card-header">
          <div className="skeleton skeleton-title"></div>
        </div>
        <div className="p-3 flex-grow-1">
          <div className="skeleton skeleton-text mb-2"></div>
          <div className="skeleton skeleton-text mb-2"></div>
          <div className="skeleton skeleton-text mb-2"></div>
          <div className="skeleton skeleton-badge"></div>
        </div>
        <div className="p-3 pt-0">
          <div className="skeleton skeleton-button"></div>
        </div>
      </div>
    </div>
  );

  const renderTableSkeleton = () => (
    <div className="lib-card p-4">
      <div className="skeleton skeleton-header mb-4"></div>
      <div className="table-responsive">
        <table className="lib-table">
          <thead>
            <tr>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <th key={i}>
                  <div className="skeleton skeleton-text"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i}>
                {[1, 2, 3, 4, 5, 6].map(j => (
                  <td key={j}>
                    <div className="skeleton skeleton-text"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStatSkeleton = () => (
    <div className="col-sm-6 col-lg-3">
      <div className="stat-card">
        <div className="skeleton skeleton-icon"></div>
        <div>
          <div className="skeleton skeleton-value"></div>
          <div className="skeleton skeleton-label"></div>
        </div>
      </div>
    </div>
  );

  const skeletons = [];
  for (let i = 0; i < count; i++) {
    if (type === 'card') {
      skeletons.push(renderCardSkeleton());
    } else if (type === 'table') {
      skeletons.push(renderTableSkeleton());
    } else if (type === 'stat') {
      skeletons.push(renderStatSkeleton());
    }
  }

  return <>{skeletons}</>;
};

export default LoadingSkeleton;
