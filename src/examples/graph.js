// @flow
/*
  Copyright(c) 2018 Uber Technologies, Inc.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

          http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

/*
  Example usage of GraphView component
*/

import * as React from 'react';

import {GraphView, type IEdgeType as IEdge, type INodeType as INode, type LayoutEngineType,} from '../';
import GraphConfig, {EMPTY_EDGE_TYPE, EMPTY_TYPE, NODE_KEY,} from './graph-config';
import Status from '../components/node'


type IGraph = {
    nodes: INode[],
    edges: IEdge[],
};

// NOTE: Edges must have 'source' & 'target' attributes
// In a more realistic use case, the graph would probably originate
// elsewhere in the App or be generated from some other state upstream of this component.
const sample: IGraph = {
    edges: [],
    nodes: [],
};

type IGraphProps = {};

type IGraphState = {
    graph: any,
    selected: any,
    totalNodes: number,
    copiedNode: any,
    layoutEngineType?: LayoutEngineType,
};

class Graph extends React.Component<IGraphProps, IGraphState> {
    GraphView;

    constructor(props: IGraphProps) {
        super(props);

        this.state = {
            copiedNode: null,
            graph: sample,
            layoutEngineType: undefined,
            selected: null,
            totalNodes: sample.nodes.length,
        };

        this.GraphView = React.createRef();
    }

    componentDidMount() {
        // Get the latest graph from the server
        fetch('http://localhost:3001/state').then(res => {
            if (res.status === 200) {
                return res.json()
            } else {
                return null;
            }

        }).then(res => {
            if (res != null) {
                this.setState({graph: res});
                this.calculateDateEstimates();
            }
        });

    }

    // Helper to find the index of a given node
    getNodeIndex(searchNode: INode | any) {
        return this.state.graph.nodes.findIndex(node => {
            return node[NODE_KEY] === searchNode[NODE_KEY];
        });
    }

    // Helper to find the index of a given edge
    getEdgeIndex(searchEdge: IEdge) {
        return this.state.graph.edges.findIndex(edge => {
            return (
                edge.source === searchEdge.source && edge.target === searchEdge.target
            );
        });
    }

    handleTitleChange = (event: any) => {
        const selected = this.state.selected;

        selected.title = event.target.value;
        this.setState(
            {
                selected: selected,
            },
            this.redrawAndSave()
        );
    };

    handleDescriptionChange = (event: any) => {
        const selected = this.state.selected;

        selected.description = event.target.value;
        this.setState(
            {
                selected: selected,
            },
            this.redrawAndSave()
        );
    };

    handleEstimateChange = (event: any) => {
        const selected = this.state.selected;

        selected.timeEstimate = event.target.value;
        this.setState(
            {
                selected: selected,
            },
            this.redrawAndSave()
        );
    };

    handleStatusChange = (event: any) => {
        const selected = this.state.selected;
        selected.status = event.target.value;
        this.setState({
            selected: selected
        }, this.redrawAndSave())
    };

    /*
     * Handlers/Interaction
     */

    // Called by 'drag' handler, etc..
    // to sync updates from D3 with the graph
    onUpdateNode = (viewNode: INode) => {
        const graph = this.state.graph;
        const i = this.getNodeIndex(viewNode);

        graph.nodes[i] = viewNode;
        this.setState({graph}, this.redrawAndSave());
    };

    // Node 'mouseUp' handler
    onSelectNode = (viewNode: INode | null) => {
        // Deselect events will send Null viewNode
        this.setState({selected: viewNode}, this.redrawAndSave());

        if (viewNode !== null) {
        }
    };

    // Edge 'mouseUp' handler
    onSelectEdge = (viewEdge: IEdge) => {
        this.setState({selected: viewEdge}, this.redrawAndSave());
    };

    // Updates the graph with a new node
    onCreateNode = (x: number, y: number) => {
        const graph = this.state.graph;

        const viewNode = {
            id: Date.now(),
            title: '',
            description: '',
            status: Status.todo,
            timeEstimate: 0,
            EMPTY_TYPE,
            x,
            y,
        };

        graph.nodes = [...graph.nodes, viewNode];
        this.setState({graph}, this.redrawAndSave());
    };

    // Deletes a node from the graph
    onDeleteNode = (viewNode: INode, nodeId: string, nodeArr: INode[]) => {
        const graph = this.state.graph;
        // Delete any connected edges
        const newEdges = graph.edges.filter((edge, i) => {
            return (
                edge.source !== viewNode[NODE_KEY] && edge.target !== viewNode[NODE_KEY]
            );
        });

        graph.nodes = nodeArr;
        graph.edges = newEdges;

        this.setState({graph, selected: null}, this.redrawAndSave());
    };

    calculateDateEstimates() {
        // We estimate the predicted time of completion of root nodes,
        // By summing the time of their dependencies recursively.
        // Lot's of features need to be added here, such as having capacity,
        // Node type (technical, business and so on)

        // For that we need to add the concept of a 'team' to the project


        // 1) Find root nodes
        // 2) Find the total number of days
        // 3) Convert that to a date, so omit weekends. This should be done at the presentation layer
        // 4) Also we need to disallow cycles, or things will exprode

        let rootNodes = this.findRootNodes();
        let graph = this.updateGraphTotalTimeEstimates(rootNodes, this.state.graph);

        this.setState({graph: graph});
    }

    findRootNodes() {
        // Gets the root nodes of the graph
        // O(n^2) for now. Can be made faster but meh.
        let rootNodes = [];
        this.state.graph.nodes.forEach(node => {
            let isRoot = true;
            this.state.graph.edges.forEach(edge => {
                if (edge.source === node.id) {
                    isRoot = false;
                }
            });

            if (isRoot) {
                rootNodes.push(node);
            }
        });

        return rootNodes;
    }

    updateGraphTotalTimeEstimates(rootNodes, graph) {
        // Update the total estimates for the entire graph
        rootNodes.forEach(node => {
            this.updateTotalTimeEstimate(node, graph);
        });

        return graph;
    }

    updateTotalTimeEstimate(node, graph) {
        if (node === undefined || node.status === 'Done') return 0;
        // Update the total time estimates for a node recursively
        node.totalTimeEstimate = parseFloat(node.timeEstimate);

        // Get children Ids
        let childrenIds = [];
        graph.edges.forEach(edge => {
            if (edge.target === node.id) {
                childrenIds.push(edge.source);
            }
        });

        // Get children ids as nodes
        let children = childrenIds.map(id => {
            for (let i = 0; i < graph.nodes.length; i++) {
                if (graph.nodes[i].id === id) {
                    return graph.nodes[i];
                }
            }
        });

        // Add their time estimate to the parents
        let max = 0;
        children.forEach(child => {
            max = Math.max(this.updateTotalTimeEstimate(child, graph), max);
        });

        node.totalTimeEstimate += max;

        return node.totalTimeEstimate;
    }


    // Creates a new node between two edges
    onCreateEdge = (sourceViewNode: INode, targetViewNode: INode) => {
        const graph = this.state.graph;

        const viewEdge = {
            source: sourceViewNode[NODE_KEY],
            target: targetViewNode[NODE_KEY],
            EMPTY_EDGE_TYPE,
        };

        // Only add the edge when the source node is not the same as the target
        if (viewEdge.source !== viewEdge.target) {
            graph.edges = [...graph.edges, viewEdge];
            this.setState(
                {
                    graph,
                    selected: viewEdge,
                },
                this.redrawAndSave()
            );
        }
    };

    // Called when an edge is reattached to a different target.
    onSwapEdge = (
        sourceViewNode: INode,
        targetViewNode: INode,
        viewEdge: IEdge
    ) => {
        const graph = this.state.graph;
        const i = this.getEdgeIndex(viewEdge);
        const edge = JSON.parse(JSON.stringify(graph.edges[i]));

        edge.source = sourceViewNode[NODE_KEY];
        edge.target = targetViewNode[NODE_KEY];
        graph.edges[i] = edge;
        // reassign the array reference if you want the graph to re-render a swapped edge
        graph.edges = [...graph.edges];

        this.setState(
            {
                graph,
                selected: edge,
            },
            this.redrawAndSave()
        );
    };

    // Called when an edge is deleted
    onDeleteEdge = (viewEdge: IEdge, edges: IEdge[]) => {
        const graph = this.state.graph;

        graph.edges = edges;
        this.setState(
            {
                graph,
                selected: null,
            },
            this.redrawAndSave()
        );
    };

    onUndo = () => {
        // Not implemented
        console.warn('Undo is not currently implemented in the example.');
        // Normally any add, remove, or update would record the action in an array.
        // In order to undo it one would simply call the inverse of the action performed. For instance, if someone
        // called onDeleteEdge with (viewEdge, i, edges) then an undelete would be a splicing the original viewEdge
        // into the edges array at position i.
    };

    onCopySelected = () => {
        if (this.state.selected.source) {
            console.warn('Cannot copy selected edges, try selecting a node instead.');

            return;
        }

        const x = this.state.selected.x + 10;
        const y = this.state.selected.y + 10;

        this.setState({
            copiedNode: {...this.state.selected, x, y},
        });
    };

    onPasteSelected = () => {
        if (!this.state.copiedNode) {
            console.warn(
                'No node is currently in the copy queue. Try selecting a node and copying it with Ctrl/Command-C'
            );
        }

        const graph = this.state.graph;
        const newNode = {...this.state.copiedNode, id: Date.now()};

        graph.nodes = [...graph.nodes, newNode];
        this.forceUpdate();
    };

    redrawAndSave = () => {
        this.calculateDateEstimates();

        this.setState({
            layoutEngineType: 'None',
        });

        this.setState({
            layoutEngineType: 'HorizontalTree',
        });

        this.saveGraph();
    };

    saveGraph() {
        const xhr = new XMLHttpRequest();

        xhr.open('POST', 'http://localhost:3001/state');

        // get a callback when the server responds
        xhr.addEventListener('load', () => {
            // update the state of the component with the result here
        });

        xhr.setRequestHeader('Content-Type', 'application/json');

        // send the request
        xhr.send(JSON.stringify(this.state.graph));
    }

    /*
     * Render
     */

    render() {
        const {nodes, edges} = this.state.graph;
        const selected = this.state.selected;
        const {NodeTypes, NodeSubtypes, EdgeTypes} = GraphConfig;

        return (
            <div id="graph">
                <div className="graph-header">
                    {this.state.selected != null && (
                        <div>
                            <label>Node Name: </label>
                            <input
                                className="node-name"
                                type="text"
                                onChange={this.handleTitleChange}
                                value={this.state.selected.title}
                            />
                            <label> Description: </label>
                            <input
                                className="node-description"
                                type="text"
                                onChange={this.handleDescriptionChange}
                                value={this.state.selected.description}
                            />
                            <label> Node Time Estimate (days): </label>
                            <input
                                className="node-time-estimate"
                                type="number"
                                onChange={this.handleEstimateChange}
                                value={this.state.selected.timeEstimate}
                            />
                            <label> Status: </label>
                            <select
                                className="node-status"
                                onChange={this.handleStatusChange}
                                value={this.state.selected.status}
                            >
                                <option value={Status.todo}>To Do</option>
                                <option value={Status.inProgress}>In Progress</option>
                                <option value={Status.done}>Done</option>
                            </select>
                        </div>
                    )}
                </div>
                <GraphView
                    ref={el => (this.GraphView = el)}
                    nodeKey={NODE_KEY}
                    nodes={nodes}
                    edges={edges}
                    selected={selected}
                    nodeTypes={NodeTypes}
                    nodeSubtypes={NodeSubtypes}
                    edgeTypes={EdgeTypes}
                    onSelectNode={this.onSelectNode}
                    onCreateNode={this.onCreateNode}
                    onUpdateNode={this.onUpdateNode}
                    onDeleteNode={this.onDeleteNode}
                    onSelectEdge={this.onSelectEdge}
                    onCreateEdge={this.onCreateEdge}
                    onSwapEdge={this.onSwapEdge}
                    onDeleteEdge={this.onDeleteEdge}
                    onUndo={this.onUndo}
                    onCopySelected={this.onCopySelected}
                    onPasteSelected={this.onPasteSelected}
                    layoutEngineType={this.state.layoutEngineType}
                />
            </div>
        );
    }
}

export default Graph;
