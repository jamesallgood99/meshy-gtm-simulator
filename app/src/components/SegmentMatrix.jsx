import React, { useState } from 'react';
import { scoreTint, variantVars } from './ui.jsx';
import { SPLIT_SPREAD, SEGMENT_LOSS } from '../lib/analysis.js';

/**
 * Variant × segment table. This is where rule 2 lives: never average away a segment split.
 * Amber marks a variant whose roles disagree by 20+ points, and any segment the overall winner loses.
 */
export default function SegmentMatrix({ analysis }) {
  const [showIndustry, setShowIndustry] = useState(false);
  const { perVariant, matrix, winner } = analysis;
  const wi = perVariant.indexOf(winner);

  return (
    <div className="panel">
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Segment</th>
              {perVariant.map((pv) => (
                <th key={pv.variant.id} scope="col" className="vcol" style={variantVars(pv.index)}>
                  <div>{pv.variant.name}</div>
                  {pv === winner && perVariant.length > 1 && <div className="winner-flag">Leader overall</div>}
                  {pv.split && <span className="split-badge" title="Best and worst roles differ by 20+ points">Split: {Math.round(pv.spread)} pts across roles</span>}
                </th>
              ))}
            </tr>
          </thead>
          {matrix.map((g) => {
            const hidden = g.collapsible && !showIndustry;
            return (
              <tbody key={g.key}>
                <tr className="group">
                  <td colSpan={perVariant.length + 1}>
                    {g.label}
                    {g.collapsible && (
                      <>
                        {' '}
                        <button className="toggle-link" onClick={() => setShowIndustry((s) => !s)}>
                          {showIndustry ? 'Hide' : `Show ${g.rows.length} ${g.label.toLowerCase()}s`}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
                {!hidden && g.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="seg">{row.name}<small>n={row.cells.find(Boolean)?.n ?? 0}</small></th>
                    {row.cells.map((cell, i) => {
                      const flag = i === wi && row.flagWinner;
                      return (
                        <td key={i} className="cell">
                          {cell ? (
                            <div
                              className={`cell-inner ${flag ? 'flag' : ''}`}
                              style={scoreTint(cell.mean)}
                              title={flag ? `The leader trails ${perVariant[row.bestIdx].variant.name} by ${Math.round(row.loss)} points here` : `${Math.round(cell.mean)} average across ${cell.n} personas`}
                            >
                              {Math.round(cell.mean)}
                            </div>
                          ) : <div className="cell-inner">–</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="matrix-legend">
        <span>Average interest<span className="ramp" style={{ background: 'linear-gradient(90deg, rgb(236,239,243), rgb(31,74,168))' }} />high</span>
        <span><span className="swatch" style={{ boxShadow: 'inset 0 0 0 2px var(--flag)' }} />Leader loses this segment by {SEGMENT_LOSS}+ points</span>
        <span><span className="swatch" style={{ background: 'var(--flag-soft)' }} />Roles disagree by {SPLIT_SPREAD}+ points</span>
      </div>
    </div>
  );
}
