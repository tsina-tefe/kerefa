<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    /**
     * @return array<string, string>
     */
    public static function typeOptions(): array
    {
        return [
            'kitchen' => 'Kitchen',
            'bar' => 'Bar',
            'dining' => 'Dining',
            'inventory' => 'Inventory',
            'admin' => 'Admin',
            'general' => 'General',
        ];
    }

    /**
     * @var list<string>
     */
    protected $fillable = [
        'branch_id',
        'code',
        'name',
        'type',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
