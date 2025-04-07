import React, { useState, useEffect } from 'react';
import { EditNodeProps, NodeType } from '../types';

/**
 * Component for editing a node in the hierarchy
 */
const EditNode: React.FC<EditNodeProps> = ({ node, onSave, onCancel }) => {
    // State for form fields
    const [name, setName] = useState('');
    const [type, setType] = useState<NodeType | string>(NodeType.ENTITY);
    const [id, setId] = useState('');
    const [parent, setParent] = useState('');

    // Initialize form fields when node changes
    useEffect(() => {
        if (node) {
            setName(node.Name);
            setType(node.Type);
            setId(node.ID);
            setParent(node.Parent);
        }
    }, [node]);

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!node) return;

        // Create updated node with form values
        const updatedNode = {
            ...node,
            Name: name,
            Type: type,
            ID: id,
            Parent: parent,
        };

        onSave(updatedNode);
    };

    // If no node is selected, show nothing
    if (!node) {
        return null;
    }

    return (
        <div className="edit-node-form">
            <h3>Edit Node</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="id">ID:</label>
                    <input
                        type="text"
                        id="id"
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        required
                        disabled={true} // IDs should not be changed after creation
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="name">Name:</label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="type">Type:</label>
                    <select
                        id="type"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        required
                    >
                        {Object.values(NodeType).map((nodeType) => (
                            <option key={nodeType} value={nodeType}>
                                {nodeType}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="parent">Parent ID:</label>
                    <input
                        type="text"
                        id="parent"
                        value={parent}
                        onChange={(e) => setParent(e.target.value)}
                        required
                        disabled={true} // Parent relationships should be changed through other means
                    />
                </div>

                <div className="form-actions">
                    <button type="submit" className="save-button">
                        Save Changes
                    </button>
                    <button type="button" className="cancel-button" onClick={onCancel}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditNode;