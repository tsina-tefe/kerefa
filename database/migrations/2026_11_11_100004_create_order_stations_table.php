<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('order_stations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('code', 50);
            $table->string('station_type', 30)->default('kitchen');
            $table->string('printer_model', 100)->default('IRP 200D');
            $table->string('printer_connection', 50)->default('thermal_80mm');
            $table->string('printer_ip', 100)->nullable();
            $table->unsignedInteger('printer_port')->default(9100);
            $table->unsignedInteger('paper_width_mm')->default(80);
            $table->boolean('auto_print')->default(true);
            $table->unsignedInteger('print_copies')->default(1);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['branch_id', 'code']);
            $table->index(['branch_id', 'station_type', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_stations');
    }
};
