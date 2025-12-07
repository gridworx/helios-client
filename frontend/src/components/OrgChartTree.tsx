import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './OrgChartTree.css';

interface OrgNode {
  userId: string;
  name: string;
  email: string;
  title: string;
  department: string;
  photoUrl?: string;
  managerId?: string;
  level: number;
  directReports: OrgNode[];
  totalReports: number;
}

interface OrgChartTreeProps {
  data: OrgNode;
  expandedNodes: Set<string>;
  selectedNode: string | null;
  searchTerm: string;
  onNodeClick: (nodeId: string) => void;
  onNodeToggle: (nodeId: string) => void;
}

const OrgChartTree: React.FC<OrgChartTreeProps> = ({
  data,
  expandedNodes,
  selectedNode,
  searchTerm,
  onNodeClick,
  onNodeToggle
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        const { width, height } = svgRef.current.parentElement.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    renderTree();
  }, [data, expandedNodes, selectedNode, searchTerm, dimensions]);

  const renderTree = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 40, right: 120, bottom: 40, left: 120 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Convert data to hierarchy with expansion control
    const processNode = (node: OrgNode): any => {
      const isExpanded = expandedNodes.has(node.userId);
      return {
        ...node,
        children: isExpanded ? node.directReports.map(processNode) : [],
        _children: node.directReports.map(processNode),
        hasChildren: node.directReports.length > 0
      };
    };

    const root = d3.hierarchy(processNode(data));

    // Create tree layout
    const treeLayout = d3.tree<any>()
      .size([height, width])
      .separation((a, b) => a.parent === b.parent ? 1.5 : 2);

    treeLayout(root);

    // Draw links
    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal<any, any>()
        .x((d: any) => d.y)
        .y((d: any) => d.x)
      )
      .style('fill', 'none')
      .style('stroke', '#d1d5db')
      .style('stroke-width', 1);

    // Draw nodes
    const node = g.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.y},${d.x})`);

    // Add node rectangles
    const nodeWidth = 180;
    const nodeHeight = 64;

    node.append('rect')
      .attr('width', nodeWidth)
      .attr('height', nodeHeight)
      .attr('x', -nodeWidth / 2)
      .attr('y', -nodeHeight / 2)
      .attr('rx', 8)
      .style('fill', (d: any) => {
        if (selectedNode === d.data.userId) return '#ede9fe';
        if (searchTerm && matchesSearch(d.data)) return '#fef3c7';
        return 'white';
      })
      .style('stroke', (d: any) => {
        if (selectedNode === d.data.userId) return 'var(--theme-primary)';
        if (searchTerm && matchesSearch(d.data)) return '#f59e0b';
        return '#e5e7eb';
      })
      .style('stroke-width', (d: any) => {
        if (selectedNode === d.data.userId) return 2;
        if (searchTerm && matchesSearch(d.data)) return 2;
        return 1;
      })
      .style('cursor', 'pointer')
      .on('click', (event, d: any) => {
        event.stopPropagation();
        onNodeClick(d.data.userId);
      });

    // Add expand/collapse button for nodes with children
    node.filter((d: any) => d.data.hasChildren)
      .append('circle')
      .attr('cx', nodeWidth / 2 + 10)
      .attr('cy', 0)
      .attr('r', 10)
      .style('fill', 'white')
      .style('stroke', '#d1d5db')
      .style('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (event, d: any) => {
        event.stopPropagation();
        onNodeToggle(d.data.userId);
      });

    node.filter((d: any) => d.data.hasChildren)
      .append('text')
      .attr('x', nodeWidth / 2 + 10)
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#6b7280')
      .style('pointer-events', 'none')
      .text((d: any) => expandedNodes.has(d.data.userId) ? '−' : '+');

    // Add user photo or icon
    const photoSize = 32;
    node.append('clipPath')
      .attr('id', (_d: any, i: number) => `clip-${i}`)
      .append('circle')
      .attr('cx', -nodeWidth / 2 + 24)
      .attr('cy', 0)
      .attr('r', photoSize / 2);

    // Add photo if available, otherwise show icon
    node.each(function(this: SVGGElement, d: any, i: number) {
      const nodeSelection = d3.select(this);

      if (d.data.photoUrl) {
        nodeSelection.append('image')
          .attr('x', -nodeWidth / 2 + 24 - photoSize / 2)
          .attr('y', -photoSize / 2)
          .attr('width', photoSize)
          .attr('height', photoSize)
          .attr('clip-path', `url(#clip-${i})`)
          .attr('href', d.data.photoUrl);
      } else {
        nodeSelection.append('circle')
          .attr('cx', -nodeWidth / 2 + 24)
          .attr('cy', 0)
          .attr('r', photoSize / 2)
          .style('fill', '#f3f4f6')
          .style('stroke', '#e5e7eb')
          .style('stroke-width', 1);

        nodeSelection.append('text')
          .attr('x', -nodeWidth / 2 + 24)
          .attr('y', 4)
          .attr('text-anchor', 'middle')
          .style('font-size', '14px')
          .style('fill', '#6b7280')
          .text(d.data.name.substring(0, 1).toUpperCase());
      }
    });

    // Add name
    node.append('text')
      .attr('x', -nodeWidth / 2 + 52)
      .attr('y', -8)
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('fill', '#1f2937')
      .text((d: any) => truncateText(d.data.name, 18));

    // Add title
    node.append('text')
      .attr('x', -nodeWidth / 2 + 52)
      .attr('y', 8)
      .style('font-size', '12px')
      .style('fill', '#6b7280')
      .text((d: any) => truncateText(d.data.title || '', 20));

    // Add department
    node.append('text')
      .attr('x', -nodeWidth / 2 + 52)
      .attr('y', 22)
      .style('font-size', '11px')
      .style('fill', '#9ca3af')
      .text((d: any) => truncateText(d.data.department || '', 22));

    // Add direct reports count
    node.filter((d: any) => d.data.directReports.length > 0)
      .append('text')
      .attr('x', nodeWidth / 2 - 10)
      .attr('y', -nodeHeight / 2 + 12)
      .attr('text-anchor', 'end')
      .style('font-size', '10px')
      .style('fill', 'var(--theme-primary)')
      .style('font-weight', '500')
      .text((d: any) => `${d.data.directReports.length} reports`);

    // Center the root node
    svg.call(zoom.transform as any, d3.zoomIdentity.translate(margin.left, dimensions.height / 2));
  };

  const matchesSearch = (node: OrgNode): boolean => {
    if (!searchTerm) return false;
    const term = searchTerm.toLowerCase();
    return !!(node.name.toLowerCase().includes(term) ||
           node.email.toLowerCase().includes(term) ||
           (node.title && node.title.toLowerCase().includes(term)) ||
           (node.department && node.department.toLowerCase().includes(term)));
  };

  const truncateText = (text: string, maxLength: number): string => {
    return text.length > maxLength ? text.substring(0, maxLength - 2) + '...' : text;
  };

  return (
    <div className="org-chart-tree">
      <svg ref={svgRef} width="100%" height="100%"></svg>
      <div className="org-chart-controls-overlay">
        <button className="zoom-btn" onClick={() => {
          const svg = d3.select(svgRef.current);
          svg.transition().duration(750).call(
            d3.zoom().scaleExtent([0.1, 3]).transform as any,
            d3.zoomIdentity
          );
        }}>
          Reset Zoom
        </button>
      </div>
    </div>
  );
};

export default OrgChartTree;