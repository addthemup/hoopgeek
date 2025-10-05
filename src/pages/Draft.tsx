import React from 'react';
import { useParams } from 'react-router-dom';
import DraftComponent from '../components/Draft/DraftComponent';

export default function Draft() {
  const { id: leagueId } = useParams<{ id: string }>();

  if (!leagueId) {
    return (
      <div>League ID not found</div>
    );
  }

  return <DraftComponent />;
}