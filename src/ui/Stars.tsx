import './stars.css';

export function Stars({ count, label = `${count} of 3 stars` }: { count: number; label?: string }) {
    return <span className="game-stars" role="img" aria-label={label}>{[1, 2, 3].map((star) => <span key={star} className={star <= count ? 'earned' : ''} aria-hidden="true">★</span>)}</span>;
}
